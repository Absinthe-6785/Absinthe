function fail(code) {
  throw new Error(code);
}

function normalizedName(raw) {
  if (!raw || raw.includes('\0') || raw.startsWith('/') || /^[A-Za-z]:/.test(raw)) fail('zip_unsafe_path');
  const slash = raw.replace(/\\/g, '/');
  const directory = slash.endsWith('/');
  const parts = [];
  for (const part of slash.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') fail('zip_traversal_path');
    parts.push(part);
  }
  if (parts.length === 0) fail('zip_unsafe_path');
  return { path: parts.join('/'), directory };
}

export function validateZipEntryNames(rawNames) {
  const rawSeen = new Set();
  const normalizedSeen = new Set();
  const caseSeen = new Set();
  const files = new Set();
  const directories = new Set();
  const validated = [];
  for (const raw of rawNames) {
    if (rawSeen.has(raw)) fail('zip_duplicate_raw_path');
    rawSeen.add(raw);
    const item = normalizedName(raw);
    const normalizedKey = `${item.path}${item.directory ? '/' : ''}`;
    if (normalizedSeen.has(normalizedKey)) fail('zip_duplicate_normalized_path');
    normalizedSeen.add(normalizedKey);
    const caseKey = normalizedKey.toLocaleLowerCase('en-US');
    if (caseSeen.has(caseKey)) fail('zip_case_fold_collision');
    caseSeen.add(caseKey);
    (item.directory ? directories : files).add(item.path);
    validated.push({ raw, ...item });
  }
  for (const file of files) {
    if (directories.has(file)) fail('zip_directory_file_collision');
    const parts = file.split('/');
    for (let index = 1; index < parts.length; index += 1) {
      if (files.has(parts.slice(0, index).join('/'))) fail('zip_directory_file_collision');
    }
  }
  return validated;
}

export function readZipCentralDirectoryNames(bytes) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let eocd = -1;
  for (let offset = data.length - 22; offset >= Math.max(0, data.length - 65_557); offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) { eocd = offset; break; }
  }
  if (eocd < 0) fail('zip_missing_central_directory');
  const entryCount = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const names = [];
  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > data.length || view.getUint32(offset, true) !== 0x02014b50) fail('zip_invalid_central_directory');
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const end = offset + 46 + nameLength;
    if (end > data.length) fail('zip_invalid_central_directory');
    try { names.push(decoder.decode(data.subarray(offset + 46, end))); }
    catch { fail('zip_invalid_entry_name'); }
    offset = end + extraLength + commentLength;
  }
  return names;
}

export function validateZipBytes(bytes) {
  return validateZipEntryNames(readZipCentralDirectoryNames(bytes));
}
