import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';

import { E3KitService } from './e3kit.service';

@Component({
    selector: 'app-home',
    templateUrl: 'home.page.html',
    styleUrls: ['home.page.scss'],
})
export class HomePage implements OnInit {
    private e3kitService: E3KitService;

    private messages: Observable<string[]>;

    constructor(e3kitService: E3KitService) {
        this.e3kitService = e3kitService;
    }

    ngOnInit() {
        this.messages = this.e3kitService.runDemo();
    }
}
