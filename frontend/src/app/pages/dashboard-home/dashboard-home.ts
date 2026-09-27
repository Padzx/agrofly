import { Component } from '@angular/core';
import { Card } from '../../shared/ui/card/card';
import { Button } from '../../shared/ui/button/button';

type IndicatorStatus = 'positive' | 'negative' | 'neutral';

interface Indicator {
  label: string;
  value: string;
  note: string;
  variation?: string;
  status?: IndicatorStatus;
}

interface AlertItem {
  title: string;
  description: string;
  type: 'warning' | 'danger' | 'info';
}

@Component({
  selector: 'app-dashboard-home',
  imports: [Card, Button],
  templateUrl: './dashboard-home.html',
  styleUrl: './dashboard-home.scss',
})
export class DashboardHome {
  readonly financialIndicators: Indicator[] = [
    {
      label: 'Receita líquida',
      value: 'R$ —',
      note: 'Período selecionado',
      variation: 'Aguardando integração',
      status: 'neutral',
    },
    {
      label: 'Custos operacionais',
      value: 'R$ —',
      note: 'Custos consolidados',
      variation: 'Aguardando integração',
      status: 'neutral',
    },
    {
      label: 'Resultado operacional',
      value: 'R$ —',
      note: 'Receita menos custos',
      variation: 'Aguardando integração',
      status: 'neutral',
    },
    {
      label: 'Margem operacional',
      value: '— %',
      note: 'Resultado sobre receita',
      variation: 'Aguardando integração',
      status: 'neutral',
    },
  ];

  readonly operationalIndicators: Indicator[] = [
    {
      label: 'Hectares executados',
      value: '— ha',
      note: 'Área atendida no período',
    },
    {
      label: 'Custo por hectare',
      value: 'R$ —',
      note: 'Custo operacional médio',
    },
    {
      label: 'Contratos ativos',
      value: '—',
      note: 'Contratos em andamento',
    },
    {
      label: 'Aeronaves em operação',
      value: '—',
      note: 'Disponíveis para execução',
    },
  ];

  readonly alerts: AlertItem[] = [
    {
      title: 'Nenhum alerta crítico',
      description: 'Os alertas serão exibidos quando os módulos estiverem integrados.',
      type: 'info',
    },
  ];
}