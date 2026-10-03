type Field = "price" | "year" | "km";
type Bound = `${Field}${"Min" | "Max"}`;
export type VehicleNumericFilters = Partial<Record<Bound, number>>;
type Token = { text: string; start: number; end: number };
type Amount = {
  value: number;
  scaled: boolean;
  currency: boolean;
  field?: Field;
  next: number;
};

const FIELD: Partial<Record<string, Field>> = Object.assign(
  Object.create(null),
  {
    preco: "price",
    valor: "price",
    orcamento: "price",
    ano: "year",
    modelo: "year",
    km: "km",
  },
);
const NUMERIC_MODEL_BRANDS = new Set([
  "peugeot",
  "fiat",
  "bmw",
  "mercedes",
  "volvo",
  "audi",
]);
const OPERATORS = [
  [
    "<=",
    [
      "ate no maximo",
      "nao mais de",
      "nao mais que",
      "nao passa de",
      "nao ultrapasse",
      "menor ou igual a",
      "no maximo",
      "ate",
    ],
  ],
  [
    ">=",
    [
      "nao menos de",
      "nao menos que",
      "maior ou igual a",
      "a partir do",
      "a partir de",
      "no minimo",
      "desde",
    ],
  ],
  ["<", ["menos de", "abaixo de", "inferior a", "menor que"]],
  [">", ["mais de", "acima de", "superior a", "maior que"]],
  ["=", ["exatamente", "igual a"]],
] as const;
const WORD_NUMBERS: Record<string, number> = Object.assign(
  Object.create(null),
  {
    zero: 0,
    um: 1,
    uma: 1,
    dois: 2,
    duas: 2,
    tres: 3,
    quatro: 4,
    cinco: 5,
    seis: 6,
    sete: 7,
    oito: 8,
    nove: 9,
    dez: 10,
    onze: 11,
    doze: 12,
    treze: 13,
    quatorze: 14,
    catorze: 14,
    quinze: 15,
    dezesseis: 16,
    dezasseis: 16,
    dezessete: 17,
    dezoito: 18,
    dezenove: 19,
    vinte: 20,
    trinta: 30,
    quarenta: 40,
    cinquenta: 50,
    sessenta: 60,
    setenta: 70,
    oitenta: 80,
    noventa: 90,
    cem: 100,
    cento: 100,
    duzentos: 200,
    trezentos: 300,
    quatrocentos: 400,
    quinhentos: 500,
    seiscentos: 600,
    setecentos: 700,
    oitocentos: 800,
    novecentos: 900,
  },
);

function normalizeNumbers(input: string): string {
  let text = input
    .replace(
      /(\d)(mil|k)(?=kms?\b|reais?\b|rodad[oa]s?\b|[kq]uilometros?\b)/g,
      "$1 $2 ",
    )
    .replace(/[–—]/g, "-")
    .replace(/≤/g, "<=")
    .replace(/≥/g, ">=")
    .replace(/\br\s*\$\s*|\brs\s*(?=\d)/g, "r$ ")
    .replace(/\bano\s*[/-]\s*modelo\b/g, "modelo")
    .replace(
      /\b(?:quilometragens?|quilometrage[mn]|kilometrage[mn]|quilometros?|kilometros?|rodagem|rodad[oa]s?)(?=$|[^a-z])/g,
      "km",
    )
    .replace(/(?<![a-z])kms?(?=$|[^a-z])/g, "km")
    .replace(/\bk\.\s*m\.(?=$|\s|\d)/g, "km")
    .replace(
      /\b(?:vlr|precos|valores|custando|custar|custa)(?=$|[^a-z])/g,
      "preco",
    )
    .replace(/\b(?:na faixa de|na faixa dos|na faixa das)\b/g, "de")
    .replace(/\b(?:pra|para)\s+cima\b/g, ">=")
    .replace(/\b(?:pra|para)\s+baixo\b/g, "<=")
    .replace(/\b(?:em diante|ou mais)\b/g, ">=")
    .replace(/\bou menos\b/g, "<=")
    .replace(/(?<![a-z])km(?:\s+km)+\b/g, "km");
  for (const [operator, phrases] of OPERATORS) {
    for (const phrase of phrases) {
      text = text.replace(
        new RegExp(`\\b${phrase.replace(/ /g, "\\s*")}(?=$|[^a-z])`, "g"),
        ` ${operator} `,
      );
    }
  }
  // "Nissan Maxima" is a model, not a maximum-price operator.
  text = text.replace(
    /(^|\b(?:km|preco|valor|orcamento|ano|modelo)\s+)(maxim[oa]|minim[oa])(?:\s*de)?(?=\s*\d)/g,
    (_, prefix: string, operator: string) =>
      `${prefix} ${operator.startsWith("max") ? "<=" : ">="} `,
  );
  // Only written amounts with an explicit numeric unit. "Um hatch" stays prose.
  const word = Object.keys(WORD_NUMBERS).join("|");
  const written = `(?:${word})(?:\\s+e\\s+(?:${word}))*`;
  const writtenValue = (phrase: string) =>
    phrase.split(/\s+e\s+/).reduce((sum, part) => sum + WORD_NUMBERS[part], 0);
  text = text.replace(
    new RegExp(
      `\\b(${written})\\s+mil(?:\\s+(?:e\\s+)?(${written}))?(?=\\s*(?:km\\b|real\\b|reais\\b|$|[<>=,;]|a\\s|e\\s))`,
      "g",
    ),
    (_, thousands: string, remainder?: string) =>
      String(
        writtenValue(thousands) * 1000 +
          (remainder ? writtenValue(remainder) : 0),
      ),
  );
  text = text.replace(
    new RegExp(`\\b(${written})\\s+(?=mil\\b|real\\b|reais\\b|km\\b)`, "g"),
    (_, phrase: string) => `${writtenValue(phrase)} `,
  );
  // Units may touch their amount: 70milkm, 70kkm, km70000. Split only
  // numeric/unit boundaries; never split a model such as C3, HB20 or 320i.
  text = text.replace(
    /(\d)(mil|k)(?=km\b|kms\b|reais?\b|rodados?\b)/g,
    "$1 $2 ",
  );
  return text;
}

function valueOf(raw: string): number {
  const value = raw.includes(",")
    ? raw.replace(/\./g, "").replace(",", ".")
    : /^\d{1,3}(?:\.\d{3})+$/.test(raw)
      ? raw.replace(/\./g, "")
      : raw;
  return Number(value);
}

/** A left-to-right scanner gives a suffix to ONE amount only. Global
 * replacements let "70 mil km até 100 mil" steal km for the next amount. */
export function parseVehicleSearchNumbers(input: string): {
  remaining: string;
  filters: VehicleNumericFilters;
  hints: string[];
  invalid: boolean;
} {
  const text = normalizeNumbers(input);
  const tokens: Token[] = Array.from(
    text.matchAll(/r\$|<=|>=|\d+(?:[.,]\d+)*|[a-z]+|[^\s]/g),
    (match) => ({
      text: match[0],
      start: match.index!,
      end: match.index! + match[0].length,
    }),
  );
  const at = (i: number) => tokens[i]?.text || "";
  const filters: VehicleNumericFilters = {};
  const removed = new Set<number>();
  const hints = new Set<string>();
  let invalid = false;
  const constrain = (field: Field, bound: "Min" | "Max", value: number) => {
    const key: Bound = `${field}${bound}`;
    const previous = filters[key];
    filters[key] =
      previous == null
        ? value
        : bound === "Min"
          ? Math.max(previous, value)
          : Math.min(previous, value);
  };
  const isOperator = (value: string) =>
    ["<=", ">=", "<", ">", "="].includes(value);
  const yearLike = (amount: Amount) =>
    !amount.currency &&
    !amount.scaled &&
    amount.value >= 1900 &&
    amount.value <= 2099;
  const readAmount = (start: number, context?: Field): Amount | undefined => {
    let i = start;
    let currency = at(i) === "r$";
    if (currency) i++;
    if (!/^\d+(?:[.,]\d+)*$/.test(at(i))) return;
    let value = valueOf(at(i++));
    if (!Number.isFinite(value)) {
      invalid = true;
      return;
    }
    const scaled = ["mil", "k"].includes(at(i));
    if (scaled) {
      value *= 1000;
      i++;
    }
    let field: Field | undefined = currency ? "price" : undefined;
    // "de km", "de quilometragem", "em reais" also belong to this amount.
    const unitIndex = ["de", "em"].includes(at(i)) ? i + 1 : i;
    const unit = at(unitIndex);
    if (["km", "real", "reais", "preco", "valor", "orcamento"].includes(unit)) {
      const unitField = unit === "km" ? "km" : "price";
      // An attached next number is a new prefix: "100mil km70000".
      const nextIsAmount =
        /^\d/.test(at(unitIndex + 1)) || isOperator(at(unitIndex + 1));
      const startsNext =
        nextIsAmount &&
        (tokens[unitIndex].end === tokens[unitIndex + 1]?.start ||
          (context && context !== unitField) ||
          (!scaled && !currency && value >= 1900 && value <= 2099));
      if (!startsNext) {
        if (field && field !== unitField) invalid = true;
        field = unitField;
        currency ||= unit === "real" || unit === "reais";
        i = unitIndex + 1;
      }
    }
    // Unknown letters glued to a number are model text, never money.
    if (
      tokens[i] &&
      tokens[i - 1].end === tokens[i].start &&
      /^[a-z]/.test(at(i)) &&
      !["a", "e"].includes(at(i))
    )
      return;
    return { value, currency, scaled, field, next: i };
  };
  const remove = (start: number, end: number) => {
    for (let i = start; i < end; i++) removed.add(i);
  };

  for (let start = 0; start < tokens.length; ) {
    let i = start;
    const modelBudgetSeparator =
      at(start - 1) === "-" &&
      /^\d+$/.test(at(start - 2)) &&
      NUMERIC_MODEL_BRANDS.has(at(start - 3));
    // Don't reinterpret numbers inside a model, plate or negative amount.
    if (
      start > 0 &&
      tokens[start - 1].end === tokens[start].start &&
      /[a-z0-9.-]$/.test(at(start - 1)) &&
      !["a", "e", "com", "por"].includes(at(start - 1)) &&
      !modelBudgetSeparator
    ) {
      start++;
      continue;
    }
    let prefix = FIELD[at(i)];
    if (prefix) {
      i++;
      if ([":", "="].includes(at(i))) i++;
    }
    let op = isOperator(at(i)) ? at(i++) : "";
    if (FIELD[at(i)]) {
      if (prefix && prefix !== FIELD[at(i)]) invalid = true;
      prefix = FIELD[at(i++)];
      if ([":", "="].includes(at(i))) i++;
    }
    const intro = ["de", "entre"].includes(at(i)) ? at(i++) : "";
    if (!op && isOperator(at(i))) op = at(i++);
    if (at(i) === "-") {
      if (op || prefix || intro) invalid = true;
      start++;
      continue;
    }
    const left = readAmount(i, prefix);
    if (!left) {
      start++;
      continue;
    }
    if (prefix && left.field && prefix !== left.field) invalid = true;
    let field = prefix || left.field;
    let end = left.next;
    let min: number | undefined;
    let max: number | undefined;
    let right: Amount | undefined;
    const connector = at(end);
    if (
      !op &&
      ["a", "-", "/", "<=", "e"].includes(connector) &&
      (connector !== "e" || intro)
    ) {
      right = readAmount(end + 1);
      if (right) {
        const mixedUnits = field && right.field && field !== right.field;
        if (mixedUnits && intro) invalid = true;
        const mixedYear =
          connector !== "/" &&
          (!field || field === "year") &&
          !right.field &&
          yearLike(left) !== yearLike(right);
        const precedingModel =
          start > 0 &&
          NUMERIC_MODEL_BRANDS.has(at(start - 1)) &&
          left.value >= 100 &&
          left.value < 4000;
        const budgetAfterModel =
          (connector === "<=" || precedingModel) &&
          !intro &&
          !prefix &&
          !left.field &&
          !left.scaled &&
          !(yearLike(left) && yearLike(right));
        if (mixedUnits || mixedYear || budgetAfterModel) right = undefined;
      }
    }
    if (right && connector === "/") {
      const fullYear = (value: number) =>
        value >= 10 && value <= 99 ? (value < 80 ? 2000 : 1900) + value : value;
      const a = fullYear(left.value),
        b = fullYear(right.value);
      if (
        !left.field &&
        !right.field &&
        !left.scaled &&
        !right.scaled &&
        a >= 1900 &&
        b >= a &&
        b <= 2099
      ) {
        field = "year";
        min = max = b;
        end = right.next;
      } else right = undefined;
    } else if (right) {
      field ||=
        right.field || (yearLike(left) && yearLike(right) ? "year" : "price");
      min = left.value;
      max = right.value;
      if (field === "year" && prefix === "year") {
        const fullYear = (value: number) =>
          value >= 10 && value <= 99
            ? (value < 80 ? 2000 : 1900) + value
            : value;
        min = fullYear(min);
        max = fullYear(max);
      }
      if (right.scaled && !left.scaled && !left.currency && min < 1000)
        min *= 1000;
      if (left.scaled && !right.scaled && !right.currency && max < 1000)
        max *= 1000;
      if (
        field === "price" &&
        !left.currency &&
        !right.currency &&
        !left.scaled &&
        !right.scaled &&
        (intro || prefix === "price") &&
        min < 1000 &&
        max < 1000
      ) {
        min *= 1000;
        max *= 1000;
      }
      // Two bare small model numbers aren't a price interval.
      if (
        field === "price" &&
        !intro &&
        !prefix &&
        !left.scaled &&
        !right.scaled &&
        !left.currency &&
        !right.currency &&
        max < 1000
      ) {
        right = undefined;
        min = max = undefined;
        field = undefined;
      } else end = right.next;
    }
    if (!right) {
      // Postfix bounds: "2020 pra cima", "70mil km para baixo".
      if (
        !op &&
        isOperator(at(end)) &&
        !readAmount(end + 1) &&
        !FIELD[at(end + 1)]
      ) {
        op = at(end++);
      }
      field ||=
        yearLike(left) && (prefix === "year" || left.value >= 2010)
          ? "year"
          : undefined;
      if (!field && (left.scaled || left.currency || left.value >= 10000 || op))
        field = "price";
      if (!field) {
        start++;
        continue;
      }
      let value = left.value;
      if (field === "year" && prefix === "year" && value >= 10 && value <= 99)
        value += value < 80 ? 2000 : 1900;
      if (
        field === "price" &&
        !left.scaled &&
        !left.currency &&
        value < 1000 &&
        (op || prefix === "price" || left.field === "price")
      )
        value *= 1000;
      if (op === "=" || (!op && field === "year")) min = max = value;
      else if ([">", ">="].includes(op))
        min = value + (op === ">" ? (field === "price" ? 0.01 : 1) : 0);
      else max = value - (op === "<" ? (field === "price" ? 0.01 : 1) : 0);
    }
    if (!field) {
      start++;
      continue;
    }
    if (field === "price" && !prefix && !left.currency && !right?.currency) {
      hints.add(
        "Sem unidade, valores como “70 mil” são tratados como preço. Para quilometragem, escreva “70 mil km”.",
      );
    }
    if (min != null) constrain(field, "Min", min);
    if (max != null) constrain(field, "Max", max);
    remove(start, end);
    start = end;
  }
  for (const field of ["price", "year", "km"] as const) {
    const min = filters[`${field}Min`],
      max = filters[`${field}Max`];
    if (min != null && max != null && min > max) {
      invalid = true;
      hints.add(
        "Os limites da busca se contradizem. Confira o valor mínimo e o máximo.",
      );
    }
  }
  if (invalid)
    hints.add(
      "Confira os números e as unidades: use R$ ou reais para preço e km para quilometragem.",
    );
  // Preserve all unrecognized text, including numeric model names. Do not
  // silently drop an unknown requirement and show cars that don't match it.
  let remaining = "";
  let cursor = 0;
  tokens.forEach((token, i) => {
    remaining +=
      text.slice(cursor, token.start) + (removed.has(i) ? " " : token.text);
    cursor = token.end;
  });
  remaining += text.slice(cursor);
  return { remaining, filters, hints: [...hints], invalid };
}
