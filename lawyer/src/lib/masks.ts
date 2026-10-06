export const onlyDigits = (v: string) => v.replace(/\D/g, '');

function apply(digits: string, pattern: string) {
  let out = '';
  let i = 0;
  for (const ch of pattern) {
    if (i >= digits.length) break;
    if (ch === '#') out += digits[i++];
    else out += ch;
  }
  return out;
}

export const maskCPF = (v: string) => apply(onlyDigits(v).slice(0, 11), '###.###.###-##');
export const maskCEP = (v: string) => apply(onlyDigits(v).slice(0, 8), '#####-###');
export const maskDate = (v: string) => apply(onlyDigits(v).slice(0, 8), '##/##/####');

export function maskPhone(v: string) {
  const d = onlyDigits(v).slice(0, 11);
  return d.length > 10 ? apply(d, '(##) #####-####') : apply(d, '(##) ####-####');
}

export function isValidCPF(value: string) {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(cpf[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(cpf[9]) && calc(10) === Number(cpf[10]);
}

export function isValidDate(value: string) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!m) return false;
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(y, mo - 1, d);
  return date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d && date <= new Date();
}

export const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
