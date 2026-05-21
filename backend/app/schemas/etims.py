import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.etims import EtimsInvoiceStatus, EtimsInvoiceType


class EtimsInvoiceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    transaction_id: uuid.UUID
    internal_invoice_no: str
    invoice_date: str           # YYYYMMDD

    seller_pin: str
    buyer_pin: str | None
    buyer_name: str
    buyer_email: str | None

    cu_invoice_no: str | None   # KRA Control Unit Invoice Number
    receipt_signature: str | None
    qr_code_url: str | None
    kra_submission_date: str | None

    taxable_amount_kes: float
    vat_amount_kes: float
    total_amount_kes: float

    status: EtimsInvoiceStatus
    retry_count: int
    last_error: str | None
    service_description: str
    invoice_type: EtimsInvoiceType

    created_at: datetime
    updated_at: datetime


class EtimsInvoiceListOut(BaseModel):
    items: list[EtimsInvoiceOut]
    total: int
    page: int
    page_size: int


# KRA API payload structures (internal use)

class EtimsItemPayload(BaseModel):
    itemSeq: int = 1
    itemCd: str
    itemClsCd: str
    itemNm: str
    pkgUnitCd: str = "NT"
    pkg: float = 1
    qtyUnitCd: str = "U"
    qty: float = 1
    prc: float
    splyAmt: float
    dcRt: float = 0
    dcAmt: float = 0
    vatCatCd: str = "A"          # A = standard 16%
    taxblAmt: float
    taxAmt: float
    totAmt: float


class EtimsInvoicePayload(BaseModel):
    tpin: str
    bhfId: str = "00"
    orgInvcNo: int = 0
    cisInvcNo: str               # Trakvora's internal invoice number
    custTpin: str | None = None
    custNm: str
    salesTyCd: str = "N"         # N = Normal
    rcptTyCd: str = "S"          # S = Sales
    pmtTyCd: str = "01"          # 01 = Cash/Online
    salesSttsCd: str = "02"      # 02 = Approved
    cfmDt: str                   # YYYYMMDD
    salesDt: str                 # YYYYMMDD
    totItemCnt: int = 1
    taxblAmtA: float             # Taxable amount at rate A (16%)
    taxRtA: float = 16.0
    taxAmtA: float
    taxblAmtB: float = 0
    taxRtB: float = 0
    taxAmtB: float = 0
    taxblAmtC: float = 0
    taxRtC: float = 0
    taxAmtC: float = 0
    taxblAmtD: float = 0
    taxRtD: float = 0
    taxAmtD: float = 0
    taxblAmtE: float = 0
    taxRtE: float = 0
    taxAmtE: float = 0
    totTaxblAmt: float
    totTaxAmt: float
    totAmt: float
    remark: str | None = None
    regrId: str = "trakvora-system"
    regrNm: str = "Trakvora Platform"
    modrId: str = "trakvora-system"
    modrNm: str = "Trakvora Platform"
    itemList: list[EtimsItemPayload]


class EtimsTokenResponse(BaseModel):
    resultCd: str
    resultMsg: str
    data: dict | None = None


class EtimsSubmitResponse(BaseModel):
    resultCd: str
    resultMsg: str
    resultDt: str | None = None
    data: dict | None = None
