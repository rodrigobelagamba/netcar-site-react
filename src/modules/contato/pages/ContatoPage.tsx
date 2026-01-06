import { cn } from "@/lib/cn";

export function ContatoPage() {
  return (
    <main className="container mx-auto flex-1 px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-6 text-4xl font-bold text-fg">Entre em Contato</h1>
        <div className="rounded-lg border border-border bg-surface p-8">
          <div className="mb-6 space-y-4">
            <div>
              <h2 className="mb-2 text-lg font-semibold text-fg">Email</h2>
              <p className="text-muted-foreground">contato@netcar.com.br</p>
            </div>
            <div>
              <h2 className="mb-2 text-lg font-semibold text-fg">Telefone</h2>
              <p className="text-muted-foreground">(11) 1234-5678</p>
            </div>
            <div>
              <h2 className="mb-2 text-lg font-semibold text-fg">Endereço</h2>
              <p className="text-muted-foreground">
                Rua Exemplo, 123 - São Paulo, SP - CEP 01234-567
              </p>
            </div>
          </div>

          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              // TODO: Implementar envio de formulário
            }}
          >
            <div>
              <label className="mb-2 block text-sm font-medium text-fg">
                Nome
              </label>
              <input
                type="text"
                required
                className={cn(
                  "w-full rounded-md border border-border bg-bg px-4 py-2",
                  "text-fg placeholder:text-muted-foreground",
                  "focus:outline-none focus:ring-2 focus:ring-primary"
                )}
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-fg">
                Email
              </label>
              <input
                type="email"
                required
                className={cn(
                  "w-full rounded-md border border-border bg-bg px-4 py-2",
                  "text-fg placeholder:text-muted-foreground",
                  "focus:outline-none focus:ring-2 focus:ring-primary"
                )}
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-fg">
                Mensagem
              </label>
              <textarea
                required
                rows={5}
                className={cn(
                  "w-full rounded-md border border-border bg-bg px-4 py-2",
                  "text-fg placeholder:text-muted-foreground",
                  "focus:outline-none focus:ring-2 focus:ring-primary"
                )}
              />
            </div>
            <button
              type="submit"
              className={cn(
                "w-full rounded-md bg-primary px-6 py-3 text-primary-foreground",
                "hover:bg-primary/90 transition-colors font-medium"
              )}
            >
              Enviar Mensagem
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
