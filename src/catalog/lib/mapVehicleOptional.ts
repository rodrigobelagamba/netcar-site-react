export interface RawVehicleOptional {
  tag?: string | null;
  descricao?: string | null;
  nome?: string | null;
}

/** Keep explicit supplier wording, including legacy `nome`, in every consumer.
 * A string may be either a tag or a description; leave it for the resolver. */
export function mapVehicleOptional(optional: string | RawVehicleOptional): {
  tag: string;
  descricao: string;
} {
  if (typeof optional === "string") return { tag: optional, descricao: "" };
  return {
    tag: optional.tag || "",
    descricao: optional.descricao || optional.nome || "",
  };
}
