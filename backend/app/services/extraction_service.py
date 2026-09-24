import asyncio
import re
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional, Set, Tuple
from urllib.parse import urljoin, urlparse
import httpx
from bs4 import BeautifulSoup
from app.config import settings
from app.core.ssrf import is_safe_url

# Regex to detect emails in HTML text
EMAIL_REGEX = re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b')

# Priority paths for business contact and team discovery
PRIORITY_PATHS = [
    "/",
    "/contact",
    "/contact-us",
    "/about",
    "/about-us",
    "/team",
    "/our-team",
    "/leadership",
    "/executives",
    "/management",
    "/company",
    "/people",
]

# Common non-email patterns or binary asset extensions to ignore
EXCLUDED_EXTENSIONS = {
    ".png", ".jpg", ".jpeg", ".gif", ".svg", ".css", ".js", ".pdf",
    ".zip", ".tar", ".gz", ".mp4", ".webp", ".ico", ".woff", ".woff2"
}

class DiscoveredContact:
    def __init__(
        self,
        email: str,
        source_url: str,
        name: Optional[str] = None,
        company: Optional[str] = None,
        job_title: Optional[str] = None,
        department: Optional[str] = None,
    ):
        self.email = email.lower().strip()
        self.source_url = source_url
        self.name = name
        self.company = company
        self.job_title = job_title
        self.department = department

    def to_dict(self) -> Dict[str, Any]:
        return {
            "email": self.email,
            "source_url": self.source_url,
            "name": self.name,
            "company": self.company,
            "job_title": self.job_title,
            "department": self.department,
        }

class ExtractionEngine:
    """SSRF-guarded, ethical web crawler for public business contact discovery."""

    def __init__(
        self,
        max_pages_per_domain: int = 5,
        max_contacts_per_domain: int = 3,
        target_department: Optional[str] = None,
        timeout_seconds: int = 10,
    ):
        self.max_pages = min(max_pages_per_domain, settings.ABSOLUTE_MAX_PAGES_PER_DOMAIN)
        self.max_contacts = min(max_contacts_per_domain, settings.ABSOLUTE_MAX_CONTACTS_PER_DOMAIN)
        self.target_department = target_department.lower() if target_department else None
        self.timeout = timeout_seconds

    async def crawl_domain(
        self,
        start_url: str,
        progress_callback: Optional[Callable[[Dict[str, Any]], None]] = None,
    ) -> List[DiscoveredContact]:
        """
        Safely crawls permitted public pages for a domain and extracts business contact info.
        """
        # Ensure scheme is present
        if not start_url.startswith(("http://", "https://")):
            start_url = "https://" + start_url

        # Check SSRF safety
        safe, reason = is_safe_url(start_url)
        if not safe:
            raise ValueError(f"SSRF Safety Guard rejected URL '{start_url}': {reason}")

        parsed_start = urlparse(start_url)
        domain = parsed_start.netloc.lower()
        company_name = self._derive_company_name(domain)

        visited_urls: Set[str] = set()
        queue: List[str] = [start_url]
        
        # Add priority contact paths on the same domain
        for path in PRIORITY_PATHS:
            target = f"{parsed_start.scheme}://{domain}{path}"
            if target not in queue:
                queue.append(target)

        discovered: List[DiscoveredContact] = []
        discovered_emails: Set[str] = set()

        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 LeadFlowAI-Crawler/1.0",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        }

        async with httpx.AsyncClient(
            headers=headers,
            timeout=self.timeout,
            follow_redirects=True,
            verify=True,
            max_redirects=4,
        ) as client:
            pages_crawled = 0

            while queue and pages_crawled < self.max_pages and len(discovered) < self.max_contacts:
                current_url = queue.pop(0)

                # Skip if already visited
                normalized_current = current_url.split("#")[0].rstrip("/")
                if normalized_current in visited_urls:
                    continue
                visited_urls.add(normalized_current)

                # Re-verify SSRF on each URL (especially if following redirects)
                safe, reason = is_safe_url(current_url)
                if not safe:
                    continue

                try:
                    resp = await client.get(current_url)
                    if resp.status_code != 200:
                        continue

                    # Verify Content-Type is HTML
                    content_type = resp.headers.get("content-type", "").lower()
                    if "text/html" not in content_type:
                        continue

                    pages_crawled += 1
                    html_text = resp.text
                    soup = BeautifulSoup(html_text, "html.parser")

                    # Extract company name from title or meta tags if not already found
                    if not company_name:
                        og_site = soup.find("meta", property="og:site_name")
                        if og_site and og_site.get("content"):
                            company_name = og_site["content"].strip()

                    # Extract contacts from this page
                    contacts_on_page = self._extract_page_contacts(
                        soup=soup,
                        page_url=str(resp.url),
                        domain=domain,
                        company_name=company_name,
                        existing_emails=discovered_emails,
                    )

                    for c in contacts_on_page:
                        if c.email not in discovered_emails and len(discovered) < self.max_contacts:
                            discovered_emails.add(c.email)
                            discovered.append(c)

                    if progress_callback:
                        progress_callback({
                            "domain": domain,
                            "pages_crawled": pages_crawled,
                            "contacts_found": len(discovered),
                            "current_page": str(resp.url),
                        })

                    # Discover additional same-domain links if below max pages
                    if pages_crawled < self.max_pages:
                        for a in soup.find_all("a", href=True):
                            href = a["href"].strip()
                            full_link = urljoin(str(resp.url), href)
                            parsed_link = urlparse(full_link)

                            if parsed_link.netloc.lower() == domain:
                                path_lower = parsed_link.path.lower()
                                if not any(path_lower.endswith(ext) for ext in EXCLUDED_EXTENSIONS):
                                    norm_link = full_link.split("#")[0].rstrip("/")
                                    if norm_link not in visited_urls and norm_link not in queue:
                                        # Prioritize relevant pages
                                        if any(p in path_lower for p in ["contact", "about", "team", "people"]):
                                            queue.insert(0, norm_link)
                                        else:
                                            queue.append(norm_link)

                except Exception:
                    # Ignore transient network or parse errors on single page
                    continue

        return discovered

    def _extract_page_contacts(
        self,
        soup: BeautifulSoup,
        page_url: str,
        domain: str,
        company_name: Optional[str],
        existing_emails: Set[str],
    ) -> List[DiscoveredContact]:
        contacts: List[DiscoveredContact] = []

        # 1. Look for mailto: links
        for a_tag in soup.find_all("a", href=re.compile(r"^mailto:", re.I)):
            href = a_tag["href"]
            email_match = re.search(r"mailto:([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7})", href, re.I)
            if email_match:
                email = email_match.group(1).lower().strip()
                if email not in existing_emails and self._is_valid_contact_email(email, domain):
                    name, title = self._infer_name_and_title(a_tag)
                    contacts.append(
                        DiscoveredContact(
                            email=email,
                            source_url=page_url,
                            name=name,
                            company=company_name,
                            job_title=title,
                            department=self.target_department,
                        )
                    )

        # 2. Look for emails in page body text
        text_content = soup.get_text(separator=" ", strip=True)
        found_in_text = EMAIL_REGEX.findall(text_content)
        for raw_email in found_in_text:
            email = raw_email.lower().strip()
            if email not in existing_emails and self._is_valid_contact_email(email, domain):
                if not any(c.email == email for c in contacts):
                    contacts.append(
                        DiscoveredContact(
                            email=email,
                            source_url=page_url,
                            name=None,
                            company=company_name,
                            job_title=None,
                            department=self.target_department,
                        )
                    )

        return contacts

    def _is_valid_contact_email(self, email: str, domain: str) -> bool:
        # Ignore common dummy or webmaster placeholders
        ignored_names = {"youremail", "example", "someone", "domain", "test", "webmaster"}
        local_part = email.split("@")[0]
        if any(ign in local_part for ign in ignored_names):
            return False
        # Filter image-extension faux emails (e.g. icon@2x.png)
        if any(email.endswith(ext) for ext in [".png", ".jpg", ".jpeg", ".gif"]):
            return False
        return True

    def _infer_name_and_title(self, tag: Any) -> Tuple[Optional[str], Optional[str]]:
        """Attempt to extract contact name or title from enclosing container."""
        parent = tag.find_parent(["div", "li", "section", "article", "p"])
        if not parent:
            return None, None

        name = None
        title = None

        # Look for headers near the tag
        header = parent.find(["h2", "h3", "h4", "h5", "strong"])
        if header:
            text = header.get_text(strip=True)
            if len(text.split()) <= 4 and not re.search(EMAIL_REGEX, text):
                name = text

        # Look for titles (e.g. class contains title or role)
        title_el = parent.find(class_=re.compile(r"title|role|position|job", re.I))
        if title_el:
            title_text = title_el.get_text(strip=True)
            if len(title_text) < 60:
                title = title_text

        return name, title

    def _derive_company_name(self, domain: str) -> str:
        parts = domain.split(".")
        if len(parts) >= 2:
            return parts[-2].capitalize()
        return domain.capitalize()
