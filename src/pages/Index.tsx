import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import AppSidebar from '@/components/AppSidebar';
import SummaryCards from '@/components/SummaryCards';
import ClientTable from '@/components/ClientTable';
import ExcelUpload from '@/components/ExcelUpload';
import MessagePreview from '@/components/MessagePreview';
import { Client } from '@/types/client';
import { addMonths } from 'date-fns';

const Index = () => {
  const [activeView, setActiveView] = useState('dashboard');
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  const handleImport = (newClients: Client[]) => {
    setClients(prev => [...prev, ...newClients]);
    setActiveView('dashboard');
  };

  const handleSendMessage = (client: Client) => {
    setSelectedClient(client);
  };

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar activeView={activeView} onViewChange={setActiveView} />

      <main className="ml-[240px] p-8">
        {activeView === 'dashboard' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold tracking-tighter">Dashboard</h2>
              <p className="text-muted-foreground text-sm mt-0.5">
                {clients.length > 0
                  ? `Tenés ${clients.length} clientes cargados.`
                  : 'Cargá un Excel para comenzar a gestionar tus cobros.'}
              </p>
            </div>

            {clients.length > 0 ? (
              <>
                <SummaryCards clients={clients} />
                <ClientTable clients={clients} onSendMessage={handleSendMessage} />
              </>
            ) : (
              <div className="mt-8">
                <ExcelUpload onImport={handleImport} />
              </div>
            )}
          </div>
        )}

        {activeView === 'clientes' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold tracking-tighter">Clientes</h2>
              <p className="text-muted-foreground text-sm mt-0.5">
                Todos tus clientes en un solo lugar.
              </p>
            </div>
            <ClientTable clients={clients} onSendMessage={handleSendMessage} />
          </div>
        )}

        {activeView === 'mensajes' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold tracking-tighter">Mensajes</h2>
              <p className="text-muted-foreground text-sm mt-0.5">
                Configurá los templates de mensajes de WhatsApp.
              </p>
            </div>
            <div className="bg-card rounded-lg shadow-card border border-border p-6 space-y-4">
              <h3 className="text-sm font-semibold">Template: Recordatorio (3 días antes)</h3>
              <div className="bg-[hsl(120_30%_95%)] rounded-lg rounded-tl-none p-4 text-sm leading-relaxed">
                Hola [Nombre], te recordamos que tu plan <strong>[Plan]</strong> vence en 3 días. El total es <strong>$[Total]</strong>.
                <br /><br />¡Que tengas un gran día! 💪
              </div>

              <h3 className="text-sm font-semibold mt-6">Template: Vencimiento (día del vencimiento)</h3>
              <div className="bg-[hsl(120_30%_95%)] rounded-lg rounded-tl-none p-4 text-sm leading-relaxed">
                Hola [Nombre], tu plan <strong>[Plan]</strong> venció hoy. El total es <strong>$[Total]</strong>.
                <br /><br />Podés pagar desde acá: 🔗 [Link Mercado Pago]
                <br /><br />¡Gracias!
              </div>
            </div>
          </div>
        )}

        {activeView === 'config' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold tracking-tighter">Configuración</h2>
              <p className="text-muted-foreground text-sm mt-0.5">
                Ajustá las integraciones y preferencias.
              </p>
            </div>
            <div className="grid gap-4 max-w-lg">
              <div className="bg-card rounded-lg shadow-card border border-border p-5">
                <h3 className="text-sm font-semibold mb-1">WhatsApp</h3>
                <p className="text-xs text-muted-foreground mb-3">Conectá tu cuenta para enviar mensajes automáticos.</p>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-status-pending text-status-pending-text">
                  No conectado
                </span>
              </div>
              <div className="bg-card rounded-lg shadow-card border border-border p-5">
                <h3 className="text-sm font-semibold mb-1">Mercado Pago</h3>
                <p className="text-xs text-muted-foreground mb-3">Conectá tu cuenta para generar links de pago y recibir webhooks.</p>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-status-pending text-status-pending-text">
                  No conectado
                </span>
              </div>
            </div>
          </div>
        )}

        {activeView === 'upload' && (
          <div className="space-y-6">
            <ExcelUpload onImport={handleImport} />
          </div>
        )}
      </main>

      <AnimatePresence>
        {selectedClient && (
          <MessagePreview client={selectedClient} onClose={() => setSelectedClient(null)} />
        )}
      </AnimatePresence>
    </div>
  );
};

export default Index;
