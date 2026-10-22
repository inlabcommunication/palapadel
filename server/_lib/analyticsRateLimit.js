// Limiti per /api/analytics/track, che è pubblico (nessun login): senza un tetto
// chiunque potrebbe riempire Firestore di eventi, consumando la quota giornaliera di
// scritture del piano Spark (la stessa che serve per salvare i risultati).

export const INSTALLATION_EVENTS_PER_MINUTE = 30;
export const INSTALLATION_EVENTS_PER_DAY = 500;
export const IP_EVENTS_PER_MINUTE = 120;
export const DEFAULT_DAILY_EVENT_LIMIT = 3000;

export function getDailyEventLimit(env = process.env) {
  const value = Number.parseInt(env.ANALYTICS_DAILY_EVENT_LIMIT ?? "", 10);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_DAILY_EVENT_LIMIT;
}

/**
 * Contatori per installazione, salvati nel documento analyticsInstallations già letto
 * dall'endpoint: nessuna lettura in più. Restituisce i campi da salvare oppure
 * allowed=false se il dispositivo ha superato un limite.
 */
export function checkInstallationRate(data, now = new Date()) {
  const minute = now.toISOString().slice(0, 16);
  const day = now.toISOString().slice(0, 10);
  const minuteCount = data?.rateMinute === minute ? Number(data.rateMinuteCount ?? 0) : 0;
  const dayCount = data?.rateDay === day ? Number(data.rateDayCount ?? 0) : 0;
  if (minuteCount >= INSTALLATION_EVENTS_PER_MINUTE || dayCount >= INSTALLATION_EVENTS_PER_DAY) {
    return { allowed: false };
  }
  return {
    allowed: true,
    fields: {
      rateMinute: minute,
      rateMinuteCount: minuteCount + 1,
      rateDay: day,
      rateDayCount: dayCount + 1,
    },
  };
}

export function isDailyLimitReached(dailyData, limit) {
  return Number(dailyData?.eventsTotal ?? 0) >= limit;
}

/**
 * Limite per IP in memoria: vale per la singola istanza serverless ancora "calda",
 * quindi è solo un primo filtro gratuito contro le raffiche da un singolo indirizzo.
 */
export function createIpRateLimiter(limit = IP_EVENTS_PER_MINUTE, maxEntries = 5000) {
  const buckets = new Map();
  return function allow(ip, now = Date.now()) {
    if (!ip) return true;
    const minute = Math.floor(now / 60000);
    const bucket = buckets.get(ip);
    if (!bucket || bucket.minute !== minute) {
      if (buckets.size >= maxEntries) buckets.clear();
      buckets.set(ip, { minute, count: 1 });
      return true;
    }
    bucket.count += 1;
    return bucket.count <= limit;
  };
}

export function getClientIp(req) {
  const forwarded = req.headers?.["x-forwarded-for"];
  const value = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return (value?.split(",")[0] || req.headers?.["x-real-ip"] || req.socket?.remoteAddress || "").trim();
}
