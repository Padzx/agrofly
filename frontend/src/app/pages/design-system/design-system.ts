import { Component } from '@angular/core';
import { Button } from '../../shared/ui/button/button';
import { Card } from '../../shared/ui/card/card';
@Component({
  selector: 'app-design-system',
  imports: [Button, Card],
  templateUrl: './design-system.html',
  styleUrl: './design-system.scss',
})
export class DesignSystem {
  readonly colors = [
    { name: 'Fundo', token: '--bg', color: '#091521' },
    { name: 'Sidebar', token: '--sidebar', color: '#0A1825' },
    { name: 'Cartões', token: '--surface', color: '#102333' },
    { name: 'Primária', token: '--primary', color: '#58DFB5' },
    { name: 'Informação', token: '--info', color: '#61B9EE' },
    { name: 'Atenção', token: '--warning', color: '#F9BA75' },
    { name: 'Erro', token: '--danger', color: '#F47E84' },
  ];
}
