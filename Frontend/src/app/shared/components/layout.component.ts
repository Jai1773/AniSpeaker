import { Component, inject, input } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { Content } from '../../models/content.model';
import { AuthService } from '../../core/services/auth.service';
@Component({
  selector: 'app-nav',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './nav.component.html',
  styleUrl: './nav.component.scss',
})
export class NavComponent {
  auth = inject(AuthService);
  private readonly router = inject(Router);
  initials(): string { return this.auth.session?.displayName?.slice(0, 2).toUpperCase() || 'IN'; }
  logout(): void { this.auth.logout(); this.router.navigate(['/']); }
}
@Component({
  selector: 'app-content-card',
  imports: [RouterLink],
  templateUrl: './content-card.component.html',
  styleUrl: './content-card.component.scss',
})
export class ContentCardComponent {
  item = input.required<Content>();
}
@Component({
  selector: 'app-footer',
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.scss',
})
export class FooterComponent {}
