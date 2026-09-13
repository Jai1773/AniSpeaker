import { Component, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Content } from '../../models/content.model';
@Component({
  selector: 'app-nav',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './nav.component.html',
  styleUrl: './nav.component.scss',
})
export class NavComponent {}
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
