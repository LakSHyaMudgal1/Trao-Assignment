import dns from 'node:dns/promises';
import net from 'node:net';
import { env } from '../../config/env.js';

export class SSRFError extends Error {
  constructor(message: string, public readonly code: string = 'SSRF_PROHIBITED') {
    super(message);
    this.name = 'SSRFError';
  }
}

/**
 * Checks whether an IPv4 address falls within a private or restricted subnet.
 */
function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map((p) => parseInt(p, 10));
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return true; // malformed, reject
  }

  const [b0, b1] = parts;

  // 0.0.0.0/8 (Current network)
  if (b0 === 0) return true;

  // 127.0.0.0/8 (Loopback)
  if (b0 === 127) return true;

  // 10.0.0.0/8 (Private-Use)
  if (b0 === 10) return true;

  // 172.16.0.0/12 (Private-Use: 172.16.0.0 - 172.31.255.255)
  if (b0 === 172 && b1 >= 16 && b1 <= 31) return true;

  // 192.168.0.0/16 (Private-Use)
  if (b0 === 192 && b1 === 168) return true;

  // 169.254.0.0/16 (Link-Local, AWS/GCP/Azure Cloud Metadata 169.254.169.254)
  if (b0 === 169 && b1 === 254) return true;

  // 100.64.0.0/10 (Carrier-Grade NAT)
  if (b0 === 100 && b1 >= 64 && b1 <= 127) return true;

  // 224.0.0.0/4 (Multicast) & 240.0.0.0/4 (Reserved)
  if (b0 >= 224) return true;

  return false;
}

/**
 * Checks whether an IPv6 address falls within a private or restricted subnet.
 */
function isPrivateIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();

  // Loopback ::1
  if (normalized === '::1' || normalized === '0:0:0:0:0:0:0:1') return true;

  // Unspecified ::
  if (normalized === '::' || normalized === '0:0:0:0:0:0:0:0') return true;

  // Link-local unicast (fe80::/10)
  if (normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) {
    return true;
  }

  // Unique local addresses (fc00::/7 - fc00:: to fdff::)
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) {
    return true;
  }

  // IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1)
  if (normalized.includes('::ffff:')) {
    const ipv4Part = normalized.split('::ffff:')[1];
    if (ipv4Part && net.isIPv4(ipv4Part)) {
      return isPrivateIPv4(ipv4Part);
    }
  }

  return false;
}

/**
 * Validates a target URL against SSRF attacks and ensures it conforms to HTTP/HTTPS.
 * 
 * @param inputUrl The raw URL string to validate
 * @param allowLocal Override flag to permit localhost during local evaluation / tests
 * @returns Normalized URL string
 */
export async function validateAndNormalizeUrl(
  inputUrl: string,
  allowLocal: boolean = env.ALLOW_LOCAL_URLS
): Promise<string> {
  if (!inputUrl || typeof inputUrl !== 'string') {
    throw new SSRFError('Invalid URL: URL cannot be empty', 'INVALID_URL');
  }

  let parsed: URL;
  try {
    parsed = new URL(inputUrl.trim());
  } catch {
    throw new SSRFError(`Malformed URL: "${inputUrl}" is not a valid absolute URL`, 'INVALID_URL');
  }

  // Protocol check
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new SSRFError(
      `Invalid protocol "${parsed.protocol}": Only HTTP and HTTPS are permitted`,
      'INVALID_PROTOCOL'
    );
  }

  const hostname = parsed.hostname.toLowerCase();

  // Allow local address if explicitly allowed (e.g. in test or evaluation CLI)
  const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  if (isLocalHost) {
    if (allowLocal) {
      parsed.hash = '';
      return parsed.toString();
    } else {
      throw new SSRFError(`Localhost address "${hostname}" is prohibited in production`, 'PROHIBITED_LOCAL');
    }
  }

  // If hostname is directly an IP literal
  if (net.isIPv4(hostname)) {
    if (isPrivateIPv4(hostname) && !allowLocal) {
      throw new SSRFError(`Target IP ${hostname} is in a private/restricted subnet`, 'PROHIBITED_IP');
    }
    parsed.hash = '';
    return parsed.toString();
  }

  if (net.isIPv6(hostname)) {
    if (isPrivateIPv6(hostname) && !allowLocal) {
      throw new SSRFError(`Target IPv6 ${hostname} is in a private/restricted subnet`, 'PROHIBITED_IP');
    }
    parsed.hash = '';
    return parsed.toString();
  }

  // Resolve DNS to verify actual destination IP (DNS Rebinding & Subnet Guard)
  try {
    const addresses = await dns.lookup(hostname, { all: true });
    if (!addresses || addresses.length === 0) {
      throw new SSRFError(`Could not resolve hostname "${hostname}"`, 'DNS_LOOKUP_FAILED');
    }

    for (const { address, family } of addresses) {
      if (family === 4 && isPrivateIPv4(address)) {
        if (!allowLocal) {
          throw new SSRFError(`Hostname "${hostname}" resolves to private IP ${address}`, 'PROHIBITED_IP');
        }
      } else if (family === 6 && isPrivateIPv6(address)) {
        if (!allowLocal) {
          throw new SSRFError(`Hostname "${hostname}" resolves to private IPv6 ${address}`, 'PROHIBITED_IP');
        }
      }
    }
  } catch (err: any) {
    if (err instanceof SSRFError) throw err;
    throw new SSRFError(`DNS resolution error for "${hostname}": ${err.message}`, 'DNS_LOOKUP_FAILED');
  }

  parsed.hash = '';
  return parsed.toString();
}
