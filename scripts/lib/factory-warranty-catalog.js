// A projeção de garantia preserva os valores recebidos, sem os fallbacks de
// apresentação do bootstrap. Copia somente campos públicos usados pelo gate.
export function factoryWarrantyCatalogFromApi(vehicle) {
  const source = Object.prototype.hasOwnProperty.call(
    vehicle,
    "factoryWarrantyVehicle",
  )
    ? vehicle.factoryWarrantyVehicle
    : {
        id: vehicle.id,
        marca: vehicle.marca,
        modelo: vehicle.modelo,
        year: vehicle.ano,
        anoFabricacao: vehicle.ano_fabricacao,
        km: vehicle.km,
        price: vehicle.valor,
        diferenciais: vehicle.diferenciais,
      };
  if (!source || typeof source !== "object" || Array.isArray(source)) return null;
  const text = (value) => (typeof value === "string" ? value : undefined);
  const number = (value) => (typeof value === "number" ? value : undefined);
  return {
    id: text(source.id),
    marca: text(source.marca),
    modelo: text(source.modelo),
    year: number(source.year),
    anoFabricacao: number(source.anoFabricacao),
    km: number(source.km),
    price: number(source.price),
    diferenciais: (Array.isArray(source.diferenciais) ? source.diferenciais : [])
      .filter((item) => item?.tag === "garantia_fabrica")
      .map(() => ({ tag: "garantia_fabrica", descricao: "" })),
  };
}
