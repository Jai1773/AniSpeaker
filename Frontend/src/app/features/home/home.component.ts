import { Component, inject, OnInit } from '@angular/core';
import { Content } from '../../models/content.model';
import { RouterLink } from '@angular/router';
import { ContentService } from '../../core/services/content.service';
import {
  NavComponent,
  ContentCardComponent,
  FooterComponent,
} from '../../shared/components/layout.component';
@Component({
  selector: 'app-row',
  standalone: true,
  imports: [ContentCardComponent, RouterLink],
  inputs: ['title', 'items'],
  templateUrl: './content-row.component.html',
  styleUrl: './content-row.component.scss',
})
export class RowComponent {
  title = '';
  items: any[] = [];
}
@Component({
  standalone: true,
  imports: [RouterLink, NavComponent, FooterComponent, RowComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnInit {
  private service = inject(ContentService);
  items: Content[] = [];
  featured: Content = this.service.items[0];
  continued: Content[] = [];
  anime: Content[] = [];
  cartoons: Content[] = [];
  movies: Content[] = [];
  error = '';
  genres = [
    'Action',
    'Adventure',
    'Comedy',
    'Fantasy',
    'Sci-Fi',
    'Animation',
    'Family',
    'Mystery',
    'Drama',
  ];

  ngOnInit(): void {
    this.service.browse().subscribe({
      next: (items) => {
        this.items = items;
        this.featured = items[0];
        this.continued = items.slice(1, 4);
        this.anime = items.filter((item) => item.type === 'Anime');
        this.cartoons = items.filter((item) => item.type === 'Cartoon');
        this.movies = items.filter((item) => item.type === 'Movie');
      },
      error: () => (this.error = 'Unable to load content. Make sure the API is running.'),
    });
  }
}
