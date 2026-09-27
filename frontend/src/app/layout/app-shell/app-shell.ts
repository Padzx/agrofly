import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Sidebar } from '../sidebar/sidebar';
import { Header } from '../header/header';
import { Footer } from '../footer/footer';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, Sidebar, Header, Footer],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.scss',
})
export class AppShell {
  readonly sidebarOpen = signal(false);
  toggleSidebar(): void { this.sidebarOpen.update(current => !current); }
  closeSidebar(): void { this.sidebarOpen.set(false); }
}
