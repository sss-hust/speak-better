const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const CERTS_DIR = path.resolve(__dirname, '..', '.certs');
const KEY_PATH = path.join(CERTS_DIR, 'key.pem');
const CERT_PATH = path.join(CERTS_DIR, 'cert.pem');

function ensureCerts() {
  if (fs.existsSync(KEY_PATH) && fs.existsSync(CERT_PATH)) {
    return {
      key: fs.readFileSync(KEY_PATH, 'utf8'),
      cert: fs.readFileSync(CERT_PATH, 'utf8')
    };
  }

  console.log('正在生成自签名 HTTPS 证书...');

  if (!fs.existsSync(CERTS_DIR)) {
    fs.mkdirSync(CERTS_DIR, { recursive: true });
  }

  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });

  const cert = generateSelfSignedCert(privateKey, publicKey);

  fs.writeFileSync(KEY_PATH, privateKey, 'utf8');
  fs.writeFileSync(CERT_PATH, cert, 'utf8');
  console.log('自签名证书已生成: .certs/key.pem, .certs/cert.pem');

  return { key: privateKey, cert };
}

function generateSelfSignedCert(privateKey, publicKey) {
  // Use Node.js X509Certificate for self-signed cert generation (Node 20+)
  const name = 'CN=HuiShuoAI,O=SpeakBetter,C=CN';
  const altNames = [
    'DNS:localhost',
    'IP:127.0.0.1',
    'IP:47.106.168.80'
  ];

  // For Node.js 20+, use crypto.createCertificate if available
  // Otherwise fall back to generating via openssl-compatible approach
  if (typeof crypto.X509Certificate !== 'undefined') {
    try {
      return createCertWithBuiltIn(privateKey, publicKey, name, altNames);
    } catch (e) {
      // Fallback to manual ASN.1 approach
    }
  }

  return createCertManual(privateKey, publicKey, altNames);
}

function createCertWithBuiltIn(privateKey, publicKey, name, altNames) {
  // Node.js doesn't have a direct cert creation API in stable,
  // so we generate a minimal self-signed cert using ASN.1 DER encoding
  return createCertManual(privateKey, publicKey, altNames);
}

function createCertManual(privateKey, publicKey, altNames) {
  // Generate a self-signed X.509 v3 certificate using raw ASN.1 DER encoding
  const pubKeyDer = pemToDer(publicKey);
  const serialNumber = crypto.randomBytes(16);
  serialNumber[0] &= 0x7f; // Ensure positive

  const now = new Date();
  const notBefore = now;
  const notAfter = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

  // Build TBS (to-be-signed) certificate
  const issuerSubject = buildRDNSequence([
    { oid: '2.5.4.3', value: 'HuiShuoAI' },      // CN
    { oid: '2.5.4.10', value: 'SpeakBetter' },    // O
    { oid: '2.5.4.6', value: 'CN' }               // C
  ]);

  const sanExtension = buildSANExtension(altNames);

  const tbs = buildTBSCertificate({
    serialNumber,
    issuer: issuerSubject,
    subject: issuerSubject,
    notBefore,
    notAfter,
    publicKeyInfo: pubKeyDer,
    extensions: [sanExtension]
  });

  // Sign TBS with private key using SHA-256
  const signer = crypto.createSign('SHA256');
  signer.update(tbs);
  const signature = signer.sign(privateKey);

  // Build final certificate
  const cert = buildCertificate(tbs, signature);
  return derToPem(cert, 'CERTIFICATE');
}

// ASN.1 DER encoding helpers
function encodeLength(length) {
  if (length < 0x80) return Buffer.from([length]);
  if (length < 0x100) return Buffer.from([0x81, length]);
  if (length < 0x10000) return Buffer.from([0x82, (length >> 8) & 0xff, length & 0xff]);
  return Buffer.from([0x83, (length >> 16) & 0xff, (length >> 8) & 0xff, length & 0xff]);
}

function encodeSequence(items) {
  const content = Buffer.concat(items);
  return Buffer.concat([Buffer.from([0x30]), encodeLength(content.length), content]);
}

function encodeSet(items) {
  const content = Buffer.concat(items);
  return Buffer.concat([Buffer.from([0x31]), encodeLength(content.length), content]);
}

function encodeInteger(value) {
  if (Buffer.isBuffer(value)) {
    // Ensure positive by prepending 0x00 if high bit set
    if (value[0] & 0x80) value = Buffer.concat([Buffer.from([0x00]), value]);
    return Buffer.concat([Buffer.from([0x02]), encodeLength(value.length), value]);
  }
  const bytes = [];
  let v = value;
  do { bytes.unshift(v & 0xff); v >>= 8; } while (v > 0);
  if (bytes[0] & 0x80) bytes.unshift(0x00);
  return Buffer.concat([Buffer.from([0x02]), encodeLength(bytes.length), Buffer.from(bytes)]);
}

function encodeOID(oid) {
  const parts = oid.split('.').map(Number);
  const bytes = [40 * parts[0] + parts[1]];
  for (let i = 2; i < parts.length; i++) {
    let v = parts[i];
    if (v < 128) { bytes.push(v); }
    else {
      const enc = [];
      enc.unshift(v & 0x7f);
      v >>= 7;
      while (v > 0) { enc.unshift((v & 0x7f) | 0x80); v >>= 7; }
      bytes.push(...enc);
    }
  }
  return Buffer.concat([Buffer.from([0x06]), encodeLength(bytes.length), Buffer.from(bytes)]);
}

function encodeUTF8String(str) {
  const buf = Buffer.from(str, 'utf8');
  return Buffer.concat([Buffer.from([0x0c]), encodeLength(buf.length), buf]);
}

function encodePrintableString(str) {
  const buf = Buffer.from(str, 'ascii');
  return Buffer.concat([Buffer.from([0x13]), encodeLength(buf.length), buf]);
}

function encodeBitString(data) {
  const content = Buffer.concat([Buffer.from([0x00]), data]); // 0 unused bits
  return Buffer.concat([Buffer.from([0x03]), encodeLength(content.length), content]);
}

function encodeContextTag(tag, data) {
  return Buffer.concat([Buffer.from([0xa0 | tag]), encodeLength(data.length), data]);
}

function encodeUTCTime(date) {
  const s = date.toISOString().replace(/[-:T]/g, '').slice(2, 14) + 'Z';
  const buf = Buffer.from(s, 'ascii');
  return Buffer.concat([Buffer.from([0x17]), encodeLength(buf.length), buf]);
}

function encodeOctetString(data) {
  return Buffer.concat([Buffer.from([0x04]), encodeLength(data.length), data]);
}

function buildRDNSequence(attrs) {
  const rdns = attrs.map(attr => {
    const attrValue = attr.oid === '2.5.4.6'
      ? encodePrintableString(attr.value)
      : encodeUTF8String(attr.value);
    const attrTypeValue = encodeSequence([encodeOID(attr.oid), attrValue]);
    return encodeSet([attrTypeValue]);
  });
  return encodeSequence(rdns);
}

function buildSANExtension(altNames) {
  const names = altNames.map(name => {
    if (name.startsWith('DNS:')) {
      const dns = Buffer.from(name.slice(4), 'ascii');
      return Buffer.concat([Buffer.from([0x82]), encodeLength(dns.length), dns]);
    }
    if (name.startsWith('IP:')) {
      const parts = name.slice(3).split('.').map(Number);
      const ip = Buffer.from(parts);
      return Buffer.concat([Buffer.from([0x87]), encodeLength(ip.length), ip]);
    }
    return Buffer.alloc(0);
  }).filter(b => b.length > 0);

  const sanValue = encodeSequence(names);
  // Extension: OID 2.5.29.17 (subjectAltName), critical=false, value
  return encodeSequence([
    encodeOID('2.5.29.17'),
    encodeOctetString(sanValue)
  ]);
}

function buildTBSCertificate({ serialNumber, issuer, subject, notBefore, notAfter, publicKeyInfo, extensions }) {
  const version = encodeContextTag(0, encodeInteger(2)); // v3
  const serial = encodeInteger(serialNumber);
  const signatureAlgo = encodeSequence([encodeOID('1.2.840.113549.1.1.11'), Buffer.from([0x05, 0x00])]); // SHA256WithRSA + NULL
  const validity = encodeSequence([encodeUTCTime(notBefore), encodeUTCTime(notAfter)]);

  const extsWrapped = encodeContextTag(3, encodeSequence(extensions));

  return encodeSequence([
    version,
    serial,
    signatureAlgo,
    issuer,
    validity,
    subject,
    publicKeyInfo,
    extsWrapped
  ]);
}

function buildCertificate(tbs, signature) {
  const signatureAlgo = encodeSequence([encodeOID('1.2.840.113549.1.1.11'), Buffer.from([0x05, 0x00])]);
  return encodeSequence([tbs, signatureAlgo, encodeBitString(signature)]);
}

function pemToDer(pem) {
  const lines = pem.split('\n').filter(line => !line.startsWith('-----'));
  return Buffer.from(lines.join(''), 'base64');
}

function derToPem(der, label) {
  const b64 = der.toString('base64');
  const lines = [];
  for (let i = 0; i < b64.length; i += 64) {
    lines.push(b64.slice(i, i + 64));
  }
  return `-----BEGIN ${label}-----\n${lines.join('\n')}\n-----END ${label}-----\n`;
}

module.exports = { ensureCerts };
