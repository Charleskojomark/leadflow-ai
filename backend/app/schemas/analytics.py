from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel

class DashboardMetricsResponse(BaseModel):
    total_leads: int
    valid_emails: int
    campaigns_sent: int
    emails_delivered: int
    bounce_rate: float
    active_campaigns: int

class DeliveryTrendItem(BaseModel):
    date: str
    sent: int
    delivered: int
    bounced: int
    unsubscribed: int

class LeadSourceItem(BaseModel):
    source: str
    count: int

class ValidationBreakdownItem(BaseModel):
    status: str
    label: str
    count: int

class CampaignPerformanceItem(BaseModel):
    id: str
    name: str
    status: str
    total: int
    sent: int
    delivered: int
    bounced: int
    replied: int
    delivery_rate: float

class RecentActivityItem(BaseModel):
    id: str
    type: str # 'extraction', 'campaign', 'validation', 'smtp'
    title: str
    description: str
    timestamp: datetime
    status: str

class AnalyticsOverviewResponse(BaseModel):
    metrics: DashboardMetricsResponse
    delivery_trends: List[DeliveryTrendItem]
    leads_by_source: List[LeadSourceItem]
    validation_breakdown: List[ValidationBreakdownItem]
    campaign_performances: List[CampaignPerformanceItem]
    recent_activity: List[RecentActivityItem]
