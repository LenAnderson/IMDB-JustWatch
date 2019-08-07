// ==UserScript==
// @name         IMDB - JustWatch
// @namespace    https://github.com/LenAnderson/
// @downloadURL  https://github.com/LenAnderson/IMDB-JustWatch/raw/master/imdb_justwatch.user.js
// @version      1.0
// @description  Adds buttons linking to Netflix, Hulu, and other streaming services to IMDB movie, TV show, and episode pages
// @author       LenAnderson
// @match        https://www.imdb.com/title/*
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      justwatch.com
// ==/UserScript==

(function() {
    'use strict';

    const api = 'https://apis.justwatch.com/content/';

    let locale = GM_getValue('imdb_just_watch_locale') || 'en_US';
    let localeMenu;
    const addMenu = ()=>{
        if (localeMenu) {
            GM_unregisterMenuCommand(localeMenu);
        }
        localeMenu = GM_registerMenuCommand(`Locale: ${locale}`, ()=>{
            let dlgWindow = window.open('about:blank', 'IMDB - JustWatch: Locale', 'resizable,innerHeight=500,innerWidth=485,centerscreen,menubar=no,toolbar=no,location=no');
            let doc = dlgWindow.document.body;
            doc.style.fontFamily = 'sans-serif';
            let title = document.createElement('h2'); {
                title.textContent = 'Change Locale';
                doc.appendChild(title);
            }
            let spinner = document.createElement('h3'); {
                spinner.textContent = 'Loading...';
                doc.appendChild(spinner);
            }
            GM_xmlhttpRequest({
                method: 'GET',
                url: `${api}locales/state`,
                onload: resp => {
                    let locales = JSON.parse(resp.responseText);
                    locales.sort((a,b)=>{
                        if (a.country > b.country) return 1;
                        if (a.country < b.country) return -1;
                        return 0;
                    });
                    spinner.remove();
                    let label = document.createElement('label'); {
                        label.appendChild(document.createTextNode('Locale: '));
                        let sel = document.createElement('select'); {
                            sel.addEventListener('change', ()=>{
                                locale = sel.value;
                                GM_setValue('imdb_just_watch_locale', locale);
                                addMenu();
                                init();
                            });
                            locales.forEach(l=>{
                                let opt = document.createElement('option'); {
                                    opt.textContent = `${l.country} (${l.full_locale})`;
                                    opt.value = l.full_locale;
                                    opt.selected = l.full_locale == locale;
                                    sel.appendChild(opt);
                                }
                            });
                            label.appendChild(sel);
                        }
                        doc.appendChild(label);
                    }
                }
            });
        });
    };
    addMenu();

    const parent = document.querySelector('.titleParent > a');
    let tv;
    if (parent) {
        tv = document.querySelector('.parentDate').textContent.replace(/^.*\((\d+)[^\d]+(\d+)\).*$/s, '$1;$2').split(';').map(it=>Number(it));
    } else {
        tv = document.querySelector('[title="See more release dates"]');
        if (tv.textContent.search('TV Series') > -1) {
            tv = tv.textContent.replace(/^.*\((\d+)[^\d]+(\d+)\).*$/s, '$1;$2').split(';').map(it=>Number(it));
        } else {
            tv = false;
        }
    }

    const type = parent || tv ? 'show' : 'movie'; // show, movie
    const year = tv ? tv : document.querySelector('#titleYear > a') ? Number(document.querySelector('#titleYear > a').textContent.trim()) : null;
    const title = parent ? parent.textContent.trim() : document.querySelector('.title_wrapper > h1').childNodes[0].textContent.trim();
    const container = document.querySelector('.title_wrapper');

    const body = {
        page_size: 1,
        page: 1,
        query: title,
        release_year_from: tv ? tv[0] : year,
        release_year_until: tv ? tv[1] : year,
        content_types: [type]
    };
    let wrapper;

    const init = () => {
        let url = `${api}titles/${locale}/popular?body=${encodeURIComponent(JSON.stringify(body))}`;
        console.log(url);


        if (wrapper) {
            wrapper.remove();
        }
        let spinner;
        wrapper = document.createElement('div'); {
            spinner = document.createElement('div'); {
                spinner.textContent = 'Connecting to JustWatch...';
                spinner.style.fontSize = '2em';
                wrapper.appendChild(spinner);
            }
            container.appendChild(wrapper);
        }


        GM_xmlhttpRequest({
            method: 'GET',
            url: `${api}providers/locale/${locale}`,
            onload: presp => {
                let providers = JSON.parse(presp.responseText);
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: url,
                    onload: (resp) => {
                        let data = JSON.parse(resp.responseText);
                        if (data.items.length == 1 && data.items[0].title == title) {
                            spinner.remove();
                            data = data.items[0];
                            console.log(data);
                            new Set(data.offers.map(it=>it.monetization_type)).forEach(type=>{
                                let block = document.createElement('div'); {
                                    block.style.display = 'inline-block';
                                    block.style.marginRight = '5px';
                                    let title = document.createElement('div'); {
                                        title.textContent = type;
                                        title.style.margin = '10px 0 2px 0';
                                        title.style.padding = '3px 6px';
                                        title.style.backgroundColor = 'rgba(255,255,255,0.2)';
                                        title.style.textAlign = 'center';
                                        block.appendChild(title);
                                    }
                                    [...new Set(data.offers.map(it=>it.urls.standard_web))].map(url=>data.offers.filter(it=>it.urls.standard_web==url&&it.monetization_type==type)).forEach(offers=>{
                                        if (offers.length > 0) {
                                            let offer = offers[0];
                                            let provider = providers.find(it=>it.id==offer.provider_id);
                                            let minPrice;
                                            let maxPrice;
                                            if (offer.retail_price) {
                                                minPrice = Math.min(...offers.map(it=>it.retail_price));
                                                maxPrice = Math.max(...offers.map(it=>it.retail_price));
                                            }
                                            let btn = document.createElement('a'); {
                                                btn.style.display = 'inline-block';
                                                btn.style.margin = '0 2px';
                                                if (offer.retail_price) {
                                                    if (minPrice != maxPrice) {
                                                        btn.title = `${offer.currency} ${minPrice} - ${offer.currency} ${maxPrice}`;
                                                    } else {
                                                        btn.title = `${offer.currency} ${minPrice}`;
                                                    }
                                                } else {
                                                    btn.title = `${offer.monetization_type}`;
                                                }
                                                btn.href = offer.urls.standard_web;
                                                let icon = document.createElement('span'); {
                                                    icon.style.backgroundImage = `url("https://images.justwatch.com${provider.icon_url.replace(/\{profile\}/,'s100')}")`;
                                                    icon.style.backgroundSize = 'cover';
                                                    icon.style.borderRadius = '20%';
                                                    icon.style.height = '50px';
                                                    icon.style.width = '50px';
                                                    icon.style.display = 'block';
                                                    icon.style.margin = 'auto';
                                                    btn.appendChild(icon);
                                                }
                                                let price = document.createElement('span'); {
                                                    let retail_price = 'Subs';
                                                    price.textContent = offer.retail_price ? `${offer.currency} ${minPrice}` : 'Subs';
                                                    price.style.display = 'block';
                                                    price.style.textAlign = 'center';
                                                    price.style.fontSize = '12px';
                                                    btn.appendChild(price);
                                                }
                                                block.appendChild(btn);
                                            }
                                        }
                                    });
                                    wrapper.appendChild(block);
                                }
                            });
                        } else {
                            spinner.textContent = `"${title}" was not found: "${(data.items[0]||{title:''}).title}"`;
                        }
                    }
                });
            }
        });
    };

    init();
})();
