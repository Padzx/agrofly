import { Routes } from '@angular/router';

import { AppShell } from './layout/app-shell/app-shell';
import { DashboardHome } from './pages/dashboard-home/dashboard-home';
import { ComingSoon } from './pages/coming-soon/coming-soon';
import { FinancialTaxes } from './pages/financial/taxes/financial-taxes';
import { FinancialBilling } from './pages/financial/billing/financial-billing';
import { FinancialAccounts } from './pages/financial/accounts/financial-accounts';
import { FinancialCosts } from './pages/financial/costs/financial-costs';
import { FinancialCashFlow } from './pages/financial/cash-flow/financial-cash-flow';
import { FinancialDre } from './pages/financial/dre/financial-dre';
import { FinancialOverview } from './pages/financial/overview/financial-overview';
import { DesignSystem } from './pages/design-system/design-system';

export const routes: Routes = [
  {
    path: '',
    component: AppShell,

    children: [
      {
        path: '',
        component: DashboardHome,
        title: 'Visão Executiva | AgroFly'
      },

      /*
       * INTELIGÊNCIA
       */

      {
        path: 'agrofly-ai',
        component: ComingSoon,
        title: 'AgroFly AI | AgroFly'
      },

      /*
       * FINANCEIRO
       */

      {
        path: 'financeiro',
        component: FinancialOverview,
        title: 'Financeiro | AgroFly'
      },
      {
        path: 'financeiro/dre',
        component: FinancialDre,
        title: 'DRE Gerencial | AgroFly'
      },
      {
        path: 'financeiro/fluxo-caixa',
        component: FinancialCashFlow,
        title: 'Fluxo de Caixa | AgroFly'
      },
      {
        path: 'financeiro/custos',
        component: FinancialCosts,
        title: 'Custos e Despesas | AgroFly'
      },

      {
        path: 'financeiro/contas-pagar-receber',
        component: FinancialAccounts,
        title: 'Contas a Pagar e Receber | AgroFly'
      },
      {
        path: 'financeiro/faturamento',
        component: FinancialBilling,
        title: 'Faturamento e Notas Fiscais | AgroFly'
      },
      {
        path: 'financeiro/tributos',
        component: FinancialTaxes,
        title: 'Tributos e Obrigações | AgroFly'
      },

      /*
       * COMERCIAL
       */

      {
        path: 'comercial/clientes-contratos',
        component: ComingSoon,
        title: 'Clientes e Contratos | AgroFly'
      },
      {
        path: 'comercial/propostas',
        component: ComingSoon,
        title: 'Propostas e Oportunidades | AgroFly'
      },
      {
        path: 'comercial/simulador',
        component: ComingSoon,
        title: 'Simulador Comercial | AgroFly'
      },
      {
        path: 'comercial/tabela',
        component: ComingSoon,
        title: 'Tabela Comercial | AgroFly'
      },

      // Compatibilidade com os endereços antigos.

      {
        path: 'clientes-contratos',
        redirectTo: 'comercial/clientes-contratos',
        pathMatch: 'full'
      },
      {
        path: 'simulador-comercial',
        redirectTo: 'comercial/simulador',
        pathMatch: 'full'
      },

      /*
       * OPERAÇÕES
       */

      {
        path: 'operacoes',
        component: ComingSoon,
        title: 'Operações | AgroFly'
      },
      {
        path: 'ordens-servico',
        redirectTo: 'operacoes/ordens-servico',
        pathMatch: 'full'
      },


      {
        path: 'operacoes/planejamento',
        component: ComingSoon,
        title: 'Planejamento e Agenda | AgroFly'
      },
      {
        path: 'operacoes/ordens-servico',
        component: ComingSoon,
        title: 'Ordens de Serviço | AgroFly'
      },
      {
        path: 'operacoes/execucao-relatorios',
        component: ComingSoon,
        title: 'Execução e Relatórios | AgroFly'
      },
      /*
       * FROTA
       */

      {
        path: 'frota',
        component: ComingSoon,
        title: 'Frota | AgroFly'
      },
      {
        path: 'frota/passaporte-digital',
        component: ComingSoon,
        title: 'Passaporte Digital | AgroFly'
      },
      {
        path: 'frota/manutencao',
        component: ComingSoon,
        title: 'Manutenção | AgroFly'
      },
      {
        path: 'frota/combustivel',
        component: ComingSoon,
        title: 'Combustível e Óleo | AgroFly'
      },
      {
        path: 'frota/estoque',
        component: ComingSoon,
        title: 'Estoque e Peças | AgroFly'
      },

      /*
       * TRIPULAÇÃO
       */

      {
        path: 'tripulacao',
        component: ComingSoon,
        title: 'Pilotos e Tripulação | AgroFly'
      },

      /*
       * MAPA
       */

      {
        path: 'mapa',
        component: ComingSoon,
        title: 'Mapa de Atuação | AgroFly'
      },

      /*
       * ADMINISTRAÇÃO
       */

      {
        path: 'documentos',
        component: ComingSoon,
        title: 'Documentos e Prazos | AgroFly'
      },
      {
        path: 'alertas',
        component: ComingSoon,
        title: 'Central de Alertas | AgroFly'
      },

      {
        path: 'administracao/usuarios',
        component: ComingSoon,
        title: 'Usuários e Permissões | AgroFly'
      },
      {
        path: 'administracao/configuracoes',
        component: ComingSoon,
        title: 'Configurações Gerais | AgroFly'
      },

      /*
       * PORTAL
       */

      {
        path: 'portal-produtor',
        component: ComingSoon,
        title: 'Portal do Produtor | AgroFly'
      },

      /*
       * DESIGN SYSTEM
       */

      {
        path: 'design-system',
        component: DesignSystem,
        title: 'Design System | AgroFly'
      }
    ]
  },

  {
    path: '**',
    redirectTo: ''
  }
];
