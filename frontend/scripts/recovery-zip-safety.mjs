function fail(code) {
  throw new Error(code);
}

function rejectZip64Extra(view, start, length, invalidCode) {
  const limit = start + length;
  for (let offset = start; offset < limit;) {
    if (offset + 4 > limit) fail(invalidCode);
    const tag = view.getUint16(offset, true);
    const size = view.getUint16(offset + 2, true);
    if (offset + 4 + size > limit) fail(invalidCode);
    if (tag === 0x0001) fail('zip64_unsupported');
    offset += 4 + size;
  }
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
  if (eocd >= 20 && view.getUint32(eocd - 20, true) === 0x07064b50) fail('zip64_unsupported');
  const disk = view.getUint16(eocd + 4, true);
  const centralDisk = view.getUint16(eocd + 6, true);
  const diskEntryCount = view.getUint16(eocd + 8, true);
  const entryCount = view.getUint16(eocd + 10, true);
  const centralSize = view.getUint32(eocd + 12, true);
  const centralOffset = view.getUint32(eocd + 16, true);
  if (entryCount === 0xffff || diskEntryCount === 0xffff || centralSize === 0xffffffff || centralOffset === 0xffffffff) fail('zip64_unsupported');
  if (disk !== 0 || centralDisk !== 0 || diskEntryCount !== entryCount) fail('zip_multi_disk_unsupported');
  if (centralOffset > eocd || centralSize > eocd - centralOffset) fail('zip_invalid_central_directory');
  let offset = centralOffset;
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const names = [];
  const localRanges = [];
  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > data.length || view.getUint32(offset, true) !== 0x02014b50) fail('zip_invalid_central_directory');
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const flags = view.getUint16(offset + 8, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const uncompressedSize = view.getUint32(offset + 24, true);
    const diskStart = view.getUint16(offset + 34, true);
    const localOffset = view.getUint32(offset + 42, true);
    if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff || localOffset === 0xffffffff) fail('zip64_unsupported');
    if (diskStart === 0xffff) fail('zip64_unsupported');
    if (diskStart !== 0) fail('zip_multi_disk_unsupported');
    if ((flags & 0x1) !== 0) fail('zip_encrypted_unsupported');
    const end = offset + 46 + nameLength;
    const entryEnd = end + extraLength + commentLength;
    if (end > data.length || entryEnd > data.length) fail('zip_invalid_central_directory');
    rejectZip64Extra(view, end, extraLength, 'zip_invalid_central_directory');
    let centralName;
    try { centralName = decoder.decode(data.subarray(offset + 46, end)); }
    catch { fail('zip_invalid_entry_name'); }
    if (localOffset >= centralOffset || localOffset + 30 > centralOffset) fail('zip_local_header_offset_invalid');
    if (view.getUint32(localOffset, true) !== 0x04034b50) fail('zip_local_header_invalid');
    const localFlags = view.getUint16(localOffset + 6, true);
    if ((localFlags & 0x1) !== 0) fail('zip_encrypted_unsupported');
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const localEnd = localOffset + 30 + localNameLength;
    const localHeaderEnd = localEnd + localExtraLength;
    if (localEnd > centralOffset || localHeaderEnd > centralOffset) fail('zip_local_header_truncated');
    rejectZip64Extra(view, localEnd, localExtraLength, 'zip_local_header_invalid');
    let localName;
    try { localName = decoder.decode(data.subarray(localOffset + 30, localEnd)); }
    catch { fail('zip_local_header_invalid'); }
    let localNormalized;
    let centralNormalized;
    try {
      localNormalized = normalizedName(localName);
      centralNormalized = normalizedName(centralName);
    } catch { fail('zip_local_header_unsafe_path'); }
    if (localName !== centralName
      || localNormalized.path !== centralNormalized.path
      || localNormalized.directory !== centralNormalized.directory) fail('zip_local_central_name_mismatch');
    if (localNormalized.path !== 'absinthe-recovery-export'
      && !localNormalized.path.startsWith('absinthe-recovery-export/')) fail('zip_invalid_root');
    if (localRanges.some(([start, finish]) => localOffset < finish && localHeaderEnd > start)) fail('zip_local_header_overlap');
    localRanges.push([localOffset, localHeaderEnd]);
    names.push(centralName);
    offset = entryEnd;
  }
  if (offset !== centralOffset + centralSize) fail('zip_invalid_central_directory');
  return names;
}

export function validateZipBytes(bytes) {
  return validateZipEntryNames(readZipCentralDirectoryNames(bytes));
}
