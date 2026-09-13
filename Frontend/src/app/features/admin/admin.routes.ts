import { Routes } from '@angular/router';
import { Component } from '@angular/core';
@Component({
  standalone: true,
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.scss',
})
export class AdminComponent {}
export const ADMIN_ROUTES: Routes = [
  { path: '', component: AdminComponent },
  { path: '**', component: AdminComponent },
];
