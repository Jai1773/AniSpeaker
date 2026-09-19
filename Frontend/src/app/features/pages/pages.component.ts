import { Component, inject, OnInit } from '@angular/core';
import { Content, Episode } from '../../models/content.model';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ContentService } from '../../core/services/content.service';
import {
  NavComponent,
  ContentCardComponent,
  FooterComponent,
} from '../../shared/components/layout.component';
const shell = [NavComponent, ContentCardComponent, FooterComponent, RouterLink];
@Component({
  standalone: true,
  imports: [NavComponent, ContentCardComponent, FooterComponent],
  templateUrl: './browse.component.html',
  styleUrl: './pages.component.scss',
})
export class BrowseComponent implements OnInit {
  svc = inject(ContentService);
  route = inject(ActivatedRoute);
  type = this.route.snapshot.paramMap.get('type');
  list: Content[] = [];
  ngOnInit(): void {
    const apiType = this.type === 'movie' || this.type === 'movies' ? 'Movie' : undefined;
    this.svc.browse(apiType).subscribe({ next: (items) => (this.list = items) });
  }
}
@Component({
  standalone: true,
  imports: [NavComponent, ContentCardComponent, FooterComponent, FormsModule],
  templateUrl: './search.component.html',
  styleUrl: './pages.component.scss',
})
export class SearchComponent {
  svc = inject(ContentService);
  query = '';
  filtered: Content[] = [];
  search(): void {
    const query = this.query.trim();
    if (!query) { this.filtered = []; return; }
    this.svc.search(query).subscribe({ next: (items) => (this.filtered = items) });
  }
}
@Component({
  standalone: true,
  imports: shell,
  templateUrl: './detail.component.html',
  styleUrl: './pages.component.scss',
})
export class DetailComponent implements OnInit {
  svc = inject(ContentService);
  private route = inject(ActivatedRoute);
  item: Content = this.svc.get(null);
  episodes: Episode[] = [];
  related: Content[] = [];
  ngOnInit(): void {
    const slug = this.route.snapshot.paramMap.get('slug');
    if (slug) this.svc.detail(slug).subscribe({ next: (result) => {
      this.item = result.item;
      this.episodes = result.episodes;
      this.svc.browse().subscribe({ next: (items) => (this.related = items.filter((item) => item.id !== result.item.id).slice(0, 6)) });
    } });
  }
}
@Component({
  standalone: true,
  imports: [NavComponent],
  templateUrl: './player.component.html',
  styleUrl: './pages.component.scss',
})
export class PlayerComponent {
  svc = inject(ContentService);
}
@Component({
  standalone: true,
  imports: [NavComponent, ContentCardComponent, FooterComponent],
  templateUrl: './watch-later.component.html',
  styleUrl: './pages.component.scss',
})
export class WatchLaterComponent {
  svc = inject(ContentService);
}
@Component({
  standalone: true,
  imports: [NavComponent, FooterComponent, RouterLink],
  templateUrl: './history.component.html',
  styleUrl: './pages.component.scss',
})
export class HistoryComponent {
  svc = inject(ContentService);
}
@Component({
  standalone: true,
  imports: [RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './pages.component.scss',
})
export class LoginComponent {}
@Component({
  standalone: true,
  imports: [RouterLink],
  templateUrl: './register.component.html',
  styleUrl: './pages.component.scss',
})
export class RegisterComponent {}
@Component({
  standalone: true,
  imports: [NavComponent, FooterComponent, RouterLink],
  templateUrl: './profile.component.html',
  styleUrl: './pages.component.scss',
})
export class ProfileComponent {}
