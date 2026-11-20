declare namespace Cloudflare {
  interface Env {
    ADMIN_EMAIL?: string;
    QPAY_ENABLED?: string;
    QPAY_BASE_URL?: string;
    QPAY_USERNAME?: string;
    QPAY_PASSWORD?: string;
    QPAY_INVOICE_CODE?: string;
    QPAY_SITE_ORIGIN?: string;
    UNEGUI_SYNC_SERVICE_HASH?: string;
    DB?: D1Database;
    BUCKET?: R2Bucket;
  }
}
