export function SobrePage() {
  return (
    <main className="container mx-auto flex-1 px-4 py-12">
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-6 text-4xl font-bold text-fg">Sobre a NetCar</h1>
        <div className="prose prose-invert max-w-none space-y-4 text-fg">
          <p className="text-muted-foreground">
            A NetCar é uma concessionária especializada em carros seminovos,
            oferecendo qualidade e confiança para nossos clientes.
          </p>
          <p className="text-muted-foreground">
            Nossa missão é facilitar a busca e compra de veículos seminovos,
            proporcionando uma experiência transparente e segura.
          </p>
          <p className="text-muted-foreground">
            Trabalhamos com as melhores marcas e modelos, sempre priorizando a
            satisfação do cliente.
          </p>
        </div>
      </div>
    </main>
  );
}
