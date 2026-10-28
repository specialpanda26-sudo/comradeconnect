// Wi-Fi: free spots, shared networks (SSID + password + real GPS location) and reseller plans (Mbps, prices, installation).
import { str, int, normPhone } from './lib.js';

const KINDS = ['spot', 'share', 'reseller'];
const PERIODS = ['hour', 'day', 'week', 'month'];
const TECH = ['Fibre', 'Wireless radio', 'Hotspot vouchers', 'Mobile 4G or 5G', 'Other'];
export const WIFI_TEXT = ['place', 'zone', 'speed_note', 'business', 'coverage', 'install_time', 'install_notes'];   // contact-filtered (no phone numbers or links)

// Kenya sits roughly between latitude -5 and 5.6 and longitude 33.5 and 42.
const inKenya = (lat, lng) => lat > -5 && lat < 5.6 && lng > 33.5 && lng < 42;

export function wifiParse(b) {
  const kind = KINDS.includes(b.kind) ? b.kind : 'spot';
  const place = str(b.place, 60);
  if (place.length < 2) return kind === 'reseller' ? 'Add the business name' : 'Add the place';
  const out = { kind, place, zone: str(b.zone, 30), speed_note: str(b.speed_note, 80) || null, coverage: str(b.coverage, 200) || null, business: str(b.business, 60) || null };

  const hasLoc = b.lat !== undefined && b.lat !== null && b.lat !== '' && b.lng !== undefined && b.lng !== null && b.lng !== '';
  if (hasLoc) {
    const lat = Number(b.lat), lng = Number(b.lng), acc = Math.round(Number(b.accuracy));
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !inKenya(lat, lng)) return 'That location is not in Kenya. Tap Use my real location again';
    if (Number.isFinite(acc) && acc > 300) return 'Your location is not accurate enough (' + acc + ' m). Stand next to the router, switch on GPS and try again';
    out.lat = +lat.toFixed(5); out.lng = +lng.toFixed(5); out.accuracy_m = Number.isFinite(acc) ? Math.max(0, acc) : null;
  }

  if (b.mbps !== undefined && b.mbps !== null && b.mbps !== '' && kind !== 'reseller') {
    const mb = int(b.mbps, 1, 100);
    if (mb === null) return 'Speed must be between 1 and 100 Mbps';
    out.speed_note = mb + ' Mbps';
  }

  if (kind === 'share') {
    if (!hasLoc) return 'Tap Use my real location while you are at the network';
    if (!b.consent) return 'Confirm that you own this network or have permission to share it';
    const ssid = String(b.ssid ?? '').trim().slice(0, 32);
    if (!ssid) return 'Add the Wi-Fi name (SSID)';
    out.ssid = ssid;
    if (b.open) out.password = null;
    else {
      const pw = String(b.password ?? '').slice(0, 63);
      if (pw.length < 8) return 'The Wi-Fi password must be at least 8 characters. Tick "Open network" if it has none';
      out.password = pw;
    }
  }

  if (kind === 'reseller') {
    if (!b.consent) return 'Confirm that you own this business or are an authorised agent';
    const raw = Array.isArray(b.packages) ? b.packages : [];
    if (raw.length < 1 || raw.length > 8) return 'Add 1 to 8 plans';
    const packages = [];
    for (const p of raw) {
      const name = str(p && p.name, 30), mbps = int(p && p.mbps, 1, 10000), price = int(p && p.price, 1, 1000000);
      const period = PERIODS.includes(p && p.period) ? p.period : null;
      if (!name || !mbps || !price || !period) return 'Every plan needs a name, the Mbps, the price in KSh and how long it lasts';
      packages.push({ name, mbps, price, period });
    }
    out.packages = packages;
    out.tech = TECH.includes(b.tech) ? b.tech : 'Other';
    const fee = int(b.install_fee, 0, 500000);
    if (fee === null) return 'Add the installation fee in KSh. Write 0 if installation is free';
    out.install_fee = fee;
    out.install_time = str(b.install_time, 40) || null;
    out.install_notes = str(b.install_notes, 300) || null;
    const ph = String(b.contact_phone ?? '').trim();
    if (ph) { const n = normPhone(ph); if (!n) return 'Phone number like 0712345678'; out.contact_phone = n; }
    out.text_extra = packages.map((p) => p.name);
  }
  return out;
}

// Passwords and phone numbers are only sent to signed-in comrades, and always to the person who posted them.
export function wifiMask(item, me) {
  if (item.kind === 'spot' || !item.kind) return item;
  const hadPw = !!item.password, hadPhone = !!item.contact_phone;
  if (!me) { item.password = undefined; item.contact_phone = undefined; }
  return { ...item, has_password: hadPw, has_phone: hadPhone, locked: !me && (hadPw || hadPhone) };
}
