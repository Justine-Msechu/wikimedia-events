// Wikimedia Events Browser - Live Data Client (secured + two-column layout + month cutoff + bound events)
class WikimediaEventsClient {
    constructor() {
      this.events = [];
      this.filteredEvents = [];
      this.countries = new Set();
      this.eventTypes = new Set();
      this.lastUpdated = null;
      this.cache = { data: null, timestamp: null, duration: 5 * 60 * 1000 };
  
      // Bind UI clicks first (so the nav works immediately)
      this.bindUIActions();
  
      // Then set up filter listeners and load data
      this.setupFilterListeners();
      this.loadEvents();
    }
  
    // ===== Basic DOM helpers =====
    $(id) { return document.getElementById(id); }
    on(id, type, handler) {
      const el = this.$(id);
      if (el) el.addEventListener(type, handler);
    }
    click(id, handler) {
      this.on(id, 'click', (e) => { e.preventDefault(); handler(e); });
    }
  
    // ===== Bind nav/buttons (no inline onclicks) =====
    bindUIActions() {
      this.click('brandHome', () => this.showMainContent());
      this.click('navRefresh', () => this.refreshEvents());
      this.click('navContact', () => this.showContact());
      this.click('btnTryAgain', () => this.refreshEvents());
      this.click('btnBackToEvents', () => this.showMainContent());
      this.click('btnClearFilters', () => this.clearFilters());
      this.click('btnClearAll', () => this.clearFilters());
    }
  
    // ===== Filter listeners (inputs/selects) =====
    setupFilterListeners() {
      const searchInput = this.$('searchInput');
      if (searchInput) searchInput.addEventListener('input', () => this.filterEvents());
      ['countryFilter','typeFilter','participationFilter'].forEach(id => {
        const el = this.$(id);
        if (el) el.addEventListener('change', () => this.filterEvents());
      });
    }
  
    // ===== UI state =====
    showLoading() {
      this.$('loadingIndicator').style.display = 'block';
      this.$('mainContent').classList.add('d-none');
      this.$('errorMessage').classList.add('d-none');
      this.$('contactSection').classList.add('d-none');
    }
    showMainContent() {
      this.$('loadingIndicator').style.display = 'none';
      this.$('mainContent').classList.remove('d-none');
      this.$('errorMessage').classList.add('d-none');
      this.$('contactSection').classList.add('d-none');
    }
    showError(msg) {
      this.$('loadingIndicator').style.display = 'none';
      this.$('mainContent').classList.add('d-none');
      this.$('errorMessage').classList.remove('d-none');
      this.$('contactSection').classList.add('d-none');
      this.$('errorText').textContent = msg || 'Unknown error.';
    }
    showContact() {
      this.$('loadingIndicator').style.display = 'none';
      this.$('mainContent').classList.add('d-none');
      this.$('errorMessage').classList.add('d-none');
      this.$('contactSection').classList.remove('d-none');
    }
  
    // ===== Lifecycle =====
    async loadEvents() {
      if (this.isCacheValid()) {
        this.events = this.cache.data;
        this.lastUpdated = new Date(this.cache.timestamp);
        this.processEvents();
        return;
      }
      this.showLoading();
      try {
        const events = await this.fetchWikipediaEvents();
        this.events = events;
        this.cache = { data: events, timestamp: Date.now(), duration: this.cache.duration };
        this.lastUpdated = new Date();
        this.processEvents();
      } catch (e) {
        console.error(e);
        this.showError('Failed to load events from Wikipedia. Please try again later.');
      }
    }
    isCacheValid() {
      return this.cache.data && this.cache.timestamp && (Date.now() - this.cache.timestamp) < this.cache.duration;
    }
    processEvents() {
      // Normalize
      this.events = this.events.map(this.normalizeEvent);
  
      // Month cutoff: keep events that start OR end on/after 1st of current month
      const cutoff = this.firstOfCurrentMonthDate();
      this.events = this.events.filter(ev => this.eventStartsOrEndsOnOrAfter(ev, cutoff));
  
      // Build filter options
      this.countries.clear(); this.eventTypes.clear();
      this.events.forEach(ev => {
        if (ev.country) this.countries.add(ev.country);
        if (ev.event_type) this.eventTypes.add(ev.event_type);
      });
      this.populateFilters();
      this.filterEvents();
      this.updateStats();
      this.showMainContent();
    }
  
    populateFilters() {
      const cf = this.$('countryFilter');
      if (cf) {
        cf.innerHTML = '<option value="">All Countries</option>';
        [...this.countries].sort().forEach(c => cf.appendChild(new Option(c, c)));
      }
      const tf = this.$('typeFilter');
      if (tf) {
        tf.innerHTML = '<option value="">All Types</option>';
        [...this.eventTypes].sort().forEach(t => tf.appendChild(new Option(t, t)));
      }
    }
  
    filterEvents() {
      const q = (this.$('searchInput')?.value || '').toLowerCase().trim();
      const country = this.$('countryFilter')?.value || '';
      const type = this.$('typeFilter')?.value || '';
      const participation = this.$('participationFilter')?.value || '';
      this.filteredEvents = this.events.filter(ev => {
        const matchesQ = !q || ev.title.toLowerCase().includes(q) || (ev.description || '').toLowerCase().includes(q);
        const matchesC = !country || ev.country === country;
        const matchesT = !type || ev.event_type === type;
        const matchesP = !participation || ev.participation_options === participation;
        return matchesQ && matchesC && matchesT && matchesP;
      });
      this.displayEvents();
      this.updateFilterStats();
    }
  
    updateStats() {
      if (this.$('totalEvents')) this.$('totalEvents').textContent = this.events.length;
      if (this.$('lastUpdated') && this.lastUpdated) {
        this.$('lastUpdated').textContent = new Intl.DateTimeFormat(undefined,{hour:'2-digit',minute:'2-digit'}).format(this.lastUpdated);
      }
    }
    updateFilterStats() {
      if (this.$('filteredCount')) this.$('filteredCount').textContent = this.filteredEvents.length;
      if (this.$('totalCount')) this.$('totalCount').textContent = this.events.length;
    }
    clearFilters() {
      if (this.$('searchInput')) this.$('searchInput').value = '';
      if (this.$('countryFilter')) this.$('countryFilter').value = '';
      if (this.$('typeFilter')) this.$('typeFilter').value = '';
      if (this.$('participationFilter')) this.$('participationFilter').value = '';
      this.filterEvents();
    }
    displayEvents() {
      const container = this.$('eventsContainer');
      const none = this.$('noEvents');
      if (!container) return;
      if (!this.filteredEvents.length) {
        container.innerHTML = '';
        if (none) none.classList.remove('d-none');
        return;
      }
      if (none) none.classList.add('d-none');
      container.innerHTML = this.filteredEvents.map(ev => this.createEventCard(ev)).join('');
    }
  
    // ===== Security helpers =====
    escape(s) {
      return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    }
    escapeAttr(s) {
      return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    }
    resolveHref(href) {
      if (!href) return "";
      if (href.startsWith("//")) return "https:" + href;
      if (href.startsWith("http://") || href.startsWith("https://")) return href;
      if (href.startsWith("/")) return "https://sw.wikipedia.org" + href;
      return "https://sw.wikipedia.org/" + href;
    }
    safeURL(rawHref) {
      const abs = this.resolveHref(rawHref || "");
      try {
        const u = new URL(abs);
        if (!/^https?:$/.test(u.protocol)) return '#';
        const ok =
          /\.wikipedia\.org$/.test(u.hostname) ||
          /\.wikimedia\.org$/.test(u.hostname) ||
          /\.wikidata\.org$/.test(u.hostname) ||
          /\.mediawiki\.org$/.test(u.hostname) ||
          /\.wikinews\.org$/.test(u.hostname) ||
          /\.wikivoyage\.org$/.test(u.hostname) ||
          /\.wikibooks\.org$/.test(u.hostname) ||
          /\.wiktionary\.org$/.test(u.hostname) ||
          /\.wikiversity\.org$/.test(u.hostname) ||
          /\.wikimediafoundation\.org$/.test(u.hostname);
        return ok ? u.href : '#';
      } catch { return '#'; }
    }
  
    // ===== Date helpers (month cutoff) =====
    firstOfCurrentMonthDate() {
      const now = new Date();
      return new Date(now.getFullYear(), now.getMonth(), 1);
    }
    parseDate(str) {
      if (!str) return null;
      if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
        const [y, m, d] = str.split('-').map(Number);
        return new Date(y, m - 1, d);
      }
      const dt = new Date(str);
      return isNaN(dt) ? null : dt;
    }
    eventStartsOrEndsOnOrAfter(ev, cutoff) {
      const s = this.parseDate(ev.start_date);
      const e = this.parseDate(ev.end_date || ev.start_date);
      if (e && e >= cutoff) return true;
      if (s && s >= cutoff) return true;
      return false;
    }
  
    // ===== Parsing helpers =====
    normalizeEvent(ev) {
      const toISO = (str) => {
        if (!str) return null;
        if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
        const d = new Date(str); if (isNaN(d)) return str;
        const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), da=String(d.getDate()).padStart(2,'0');
        return `${y}-${m}-${da}`;
      };
      return { ...ev, start_date: toISO(ev.start_date), end_date: toISO(ev.end_date) };
    }
    extractLabeledValue(text, labels, stopLabels) {
      const t = text.replace(/\s+/g, ' ').trim();
      let start = -1, used = null;
      for (const l of labels) {
        const i = t.toLowerCase().indexOf(l.toLowerCase());
        if (i >= 0 && (start === -1 || i < start)) { start = i; used = l; }
      }
      if (start < 0) return null;
      let rest = t.slice(start + used.length).replace(/^[:\s]+/,'').trim();
      const lowers = rest.toLowerCase();
      let cutAt = rest.length;
      for (const sl of stopLabels) {
        const pos = lowers.indexOf(sl.toLowerCase());
        if (pos >= 0 && pos < cutAt) cutAt = pos;
      }
      rest = rest.slice(0, cutAt).trim();
      return rest || null;
    }
    stripKnownLabels(text) {
      const labels = [
        'Participation options','Ushiriki','Tukio la mtandaoni','Tukio la ana kwa ana',
        'Country','Nchi','Event type','Event types','Aina ya tukio','Wiki','Topics',
        'Waandaaji','Organizers','Organiser(s)','Organisateurs','Organisateur(s)',
        'Dates','Tarehe','Mahali','Location'
      ];
      let s = text;
      labels.forEach(l => { s = s.replace(new RegExp(`\\b${l}\\b\\s*:?\\s*`, 'gi'), ''); });
      return s.replace(/\s{2,}/g, ' ').trim();
    }
  
    // ===== Card =====
    createEventCard(ev) {
      const fmt = (d) => {
        if (!d) return '—';
        const dt = new Date(d); if (isNaN(dt)) return d;
        return dt.toLocaleDateString(undefined, { year:'numeric', month:'long', day:'numeric' });
      };
  
      const typeChips = ev.event_type ? `<span class="pill">${this.escape(ev.event_type)}</span>` : '<span class="pill">Other</span>';
      const topicsChips = (ev.topics && ev.topics.length)
        ? ev.topics.map(t => `<span class="pill">${this.escape(t)}</span>`).join('')
        : '';
      const organizersChips = (ev.organizers && ev.organizers.length)
        ? ev.organizers.map(o => `<span class="organizer-chip">${this.escape(o)}</span>`).join('')
        : '—';
  
      const participationBadge = (p) => {
        const cls = { 'online':'participation-online','in-person':'participation-in-person','hybrid':'participation-hybrid' }[p] || 'bg-secondary';
        const label = { 'online':'Tukio la mtandaoni','in-person':'Tukio la ana kwa ana','hybrid':'Tukio la mtandaoni na la ana kwa ana' }[p] || p || '—';
        return `<span class="badge ${cls}">${label}</span>`;
      };
      const partHTML = ev.participation_options ? participationBadge(ev.participation_options) : '<span class="pill">—</span>';
  
      const dateRange = (ev.start_date || ev.end_date)
        ? `${fmt(ev.start_date)} – ${fmt(ev.end_date || ev.start_date)}`
        : '—';
  
      const linkAttr = this.escapeAttr(ev.link || '#');
  
      return `
        <div class="col-12 mb-4">
          <div class="card event-card border">
            <div class="card-body">
              <h4 class="event-title mb-3">
                ${this.escape(ev.title)}
                <a href="${linkAttr}" target="_blank" rel="noopener noreferrer" class="text-decoration-none" title="Open on wiki">
                  <i class="fa-solid fa-up-right-from-square"></i>
                </a>
              </h4>
  
              <div class="event-detail">
                <!-- LEFT -->
                <div class="detail-left">
                  <div class="detail-section">
                    <div class="detail-label"><i class="fa-solid fa-calendar-days"></i> Date Range:</div>
                    <div>${dateRange}</div>
                  </div>
  
                  <div class="detail-section">
                    <div class="detail-label"><i class="fa-solid fa-earth-africa"></i> Country:</div>
                    <div>${ev.country ? `<span class="pill">${this.escape(ev.country)}</span>` : '—'}</div>
                  </div>
  
                  <div class="detail-section">
                    <div class="detail-label"><i class="fa-solid fa-users"></i> Participation:</div>
                    <div>${partHTML}</div>
                  </div>
  
                  <div class="detail-section">
                    <div class="detail-label"><i class="fa-solid fa-tags"></i> Event Types:</div>
                    <div>${typeChips}</div>
                  </div>
  
                  <div class="detail-section">
                    <div class="detail-label"><i class="fa-solid fa-hashtag"></i> Topics:</div>
                    <div>${topicsChips || '—'}</div>
                  </div>
  
                  <div class="detail-section">
                    <div class="detail-label"><i class="fa-solid fa-user"></i> Organizers:</div>
                    <div>${organizersChips}</div>
                  </div>
                </div>
  
                <!-- RIGHT -->
                <div class="right-col">
                  <div>
                    <div class="side-label">Starts</div>
                    <div class="side-value">${fmt(ev.start_date)}</div>
                  </div>
                  <div>
                    <div class="side-label">Ends</div>
                    <div class="side-value">${fmt(ev.end_date || ev.start_date)}</div>
                  </div>
                  <a href="${linkAttr}" target="_blank" rel="noopener noreferrer" class="btn btn-primary view-btn">
                    <i class="fa-solid fa-eye"></i> View Event
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    }
  
    // ===== Fetch & Parse =====
    async fetchWikipediaEvents() {
      const apiUrl =
        "https://sw.wikipedia.org/w/api.php" +
        "?action=parse&format=json&formatversion=2" +
        "&prop=text&contentmodel=wikitext" +
        "&text=" + encodeURIComponent("{{Special:AllEvents}}") +
        "&origin=*";
  
      const res = await fetch(apiUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const html = data?.parse?.text || "";
      if (!html) throw new Error("Empty HTML from parse API");
  
      const doc = new DOMParser().parseFromString(html, "text/html");
  
      const containers = [
        ".ext-campaignevents-collaborationlist",
        ".mw-collaborationlist",
        ".collaborationlist",
        ".mw-parser-output",
        "main"
      ];
  
      let eventNodes = [];
      for (const sel of containers) {
        const root = doc.querySelector(sel);
        if (!root) continue;
        eventNodes = root.querySelectorAll(
          [
            '[data-ce-event-id]',
            '.ce-event-card, .event-card, .mw-event-card',
            '.ce-event',
            '.mw-list-item .mw-ui-card',
            'a[href*="Special:EventDetails"]',
            'a[href*="/wiki/"]'
          ].join(', ')
        );
        if (eventNodes.length) break;
      }
  
      const events = [];
      const seen = new Set();
      const countryHints = [
        "Tanzania","Kenya","Uganda","Rwanda","Burundi","DRC","Ethiopia","Nigeria","Ghana","South Africa",
        "United States","United Kingdom","France","Germany","India","Canada","Singapore","Netherlands","Benin",
        "Jamhuri ya Kidemokrasia ya Kongo"
      ];
      const typeHints = ["Conference","Workshop","Meetup","Hackathon","Training","Competition","Contest","Edit-a-thon","Editing event","Community","Other"];
      const stopLabels = [
        'Dates','Tarehe','Location','Mahali','Country','Nchi','Event type','Event types','Aina ya tukio',
        'Participation options','Ushiriki','Wiki','Topics',
        'Waandaaji','Organizers','Organiser(s)','Organisateurs','Organisateur(s)'
      ];
  
      eventNodes.forEach(node => {
        const a = node.tagName?.toLowerCase() === 'a' ? node : node.querySelector('a[href]');
        if (!a) return;
  
        const rawHref = a.getAttribute('href') || a.href || "";
        const link = this.safeURL(rawHref);
        if (!link || seen.has(link)) return;
        seen.add(link);
  
        const title = (a.getAttribute('title') || a.textContent || '').trim();
  
        const wrapper = node.closest('.card, .mw-ui-card, li, tr, div') || node;
        let aroundText = (wrapper?.textContent || node.textContent || '').replace(/\s+/g,' ').trim();
        const lower = aroundText.toLowerCase();
  
        // Labeled values
        const orgRaw = this.extractLabeledValue(aroundText, ['Waandaaji','Organizers','Organiser(s)','Organisateurs','Organisateur(s)'], stopLabels);
        const countryLabeled = this.extractLabeledValue(aroundText, ['Country','Nchi'], stopLabels);
        const typeLabeled = this.extractLabeledValue(aroundText, ['Event type','Event types','Aina ya tukio'], stopLabels);
        const topicsRaw = this.extractLabeledValue(aroundText, ['Wiki','Topics'], stopLabels);
        const locLabeled = this.extractLabeledValue(aroundText, ['Location','Mahali'], stopLabels);
  
        // Dates
        const dateLabelRange = this.extractLabeledValue(aroundText, ['Dates','Tarehe'], stopLabels);
        let start_date = null, end_date = null;
        if (dateLabelRange) {
          const parts = dateLabelRange.split(/[-–—to]+/i).map(s => s.trim()).filter(Boolean);
          if (parts.length >= 2) { start_date = parts[0]; end_date = parts[1]; }
          else { start_date = dateLabelRange; end_date = dateLabelRange; }
        } else {
          const dateMatches = aroundText.match(/(\d{4}-\d{2}-\d{2}|\d{1,2}\s+\w+\s+\d{4}|\w+\s+\d{1,2},\s*\d{4})/g) || [];
          start_date = dateMatches[0] || null;
          end_date = dateMatches[1] || start_date;
        }
  
        // Participation
        let participation_options = '';
        if (lower.includes('hybrid') || lower.includes('mtandaoni na la ana kwa ana')) participation_options = 'hybrid';
        else if (lower.includes('in-person') || lower.includes('in person') || lower.includes('ana kwa ana')) participation_options = 'in-person';
        else if (lower.includes('online') || lower.includes('mtandaoni')) participation_options = 'online';
  
        // Type / Country fallbacks
        const event_type = (typeLabeled && typeHints.find(t => typeLabeled.toLowerCase().includes(t.toLowerCase()))) ||
                           typeHints.find(t => lower.includes(t.toLowerCase())) || 'Other';
        const country = countryLabeled || countryHints.find(c => aroundText.includes(c)) || '';
  
        // Location
        const locEl = wrapper.querySelector('.mw-event-location, .event-location, [class*="location"]');
        const location = (locLabeled || locEl?.textContent || '').replace(/\s+/g,' ').trim() || country || '';
  
        // Organizers / Topics arrays
        const splitList = (s) => (s || '')
          .split(/,|;| na | and | & /i)
          .map(x => x.trim())
          .filter(Boolean);
  
        const organizers = splitList(orgRaw);
        const topics = splitList(topicsRaw);
  
        // Description (strip labels)
        let description = (wrapper.querySelector('.mw-event-description, .event-desc, p, small')?.textContent || '').trim();
        if (!description) description = aroundText;
        description = this.stripKnownLabels(description);
  
        events.push({
          id: link,
          title: title || 'Untitled event',
          description,
          start_date,
          end_date,
          country,
          location,
          event_type,
          participation_options,
          topics,
          link,
          organizers
        });
      });
  
      if (!events.length) throw new Error('No events parsed. The page layout may have changed or there are no events.');
  
      // Dedup
      const uniq = new Map();
      for (const e of events) {
        const k = `${e.title}::${e.start_date || ''}`;
        if (!uniq.has(k)) uniq.set(k, e);
      }
      return [...uniq.values()];
    }
  
    // ===== Public (bound to buttons in bindUIActions) =====
    async refreshEvents() {
      this.cache.data = null; this.cache.timestamp = null;
      await this.loadEvents();
    }
  }
  
  // Start app
  document.addEventListener('DOMContentLoaded', () => {
    window.eventsClient = new WikimediaEventsClient();
  });
  