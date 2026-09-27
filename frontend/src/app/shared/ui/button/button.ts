import { Component, EventEmitter, Input, Output } from '@angular/core';
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';
@Component({ selector: 'ui-button', templateUrl: './button.html', styleUrl: './button.scss' })
export class Button {
  @Input() variant: ButtonVariant = 'primary';
  @Input() size: ButtonSize = 'md';
  @Input() type: 'button' | 'submit' | 'reset' = 'button';
  @Input() disabled = false;
  @Input() loading = false;
  @Output() readonly pressed = new EventEmitter<MouseEvent>();
}
