/** Mini-mockups pour la section « Comment ça marche » (zigzag). */

export function ZzVisualUpload() {
  return (
    <div className="zz-visual zz-visual--upload">
      <div className="zz-v-chrome">
        <span className="zz-v-dot zz-v-dot--r" />
        <span className="zz-v-dot zz-v-dot--o" />
        <span className="zz-v-dot zz-v-dot--g" />
      </div>

      <div className="zz-v-file">
        <div className="zz-v-file-icon zz-v-file-icon--pdf">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#E24B4A" strokeWidth="2" aria-hidden>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        </div>
        <div>
          <div className="zz-v-file-name">bulletin_mars_kone.pdf</div>
          <div className="zz-v-file-meta">245 Ko</div>
        </div>
      </div>

      <div className="zz-v-file">
        <div className="zz-v-file-icon zz-v-file-icon--pdf">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#E24B4A" strokeWidth="2" aria-hidden>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        </div>
        <div>
          <div className="zz-v-file-name">bulletin_mars_diarra.pdf</div>
          <div className="zz-v-file-meta">312 Ko</div>
        </div>
      </div>

      <div className="zz-v-drop">
        <svg className="zz-v-drop-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
        </svg>
        <div className="zz-v-drop-text">+ 1 845 fichiers déposés</div>
      </div>
    </div>
  )
}

export function ZzVisualTable() {
  return (
    <div className="zz-visual zz-visual--table">
      <div className="zz-v-chrome">
        <span className="zz-v-dot zz-v-dot--r" />
        <span className="zz-v-dot zz-v-dot--o" />
        <span className="zz-v-dot zz-v-dot--g" />
      </div>

      <div className="zz-v-table-head">
        <span>COLLABORATEUR</span>
        <span>STATUT</span>
      </div>

      <div className="zz-v-table-row">
        <div className="zz-v-avatar zz-v-avatar--teal">AK</div>
        <div className="zz-v-name">Koné Aminata</div>
        <div className="zz-v-pill zz-v-pill--ok">Auto</div>
      </div>

      <div className="zz-v-table-row">
        <div className="zz-v-avatar zz-v-avatar--orange">YD</div>
        <div className="zz-v-name">Diarra Yao</div>
        <div className="zz-v-pill zz-v-pill--ok">Auto</div>
      </div>

      <div className="zz-v-table-row">
        <div className="zz-v-avatar zz-v-avatar--red">MC</div>
        <div className="zz-v-name">Coulibaly M.</div>
        <div className="zz-v-pill zz-v-pill--warn">À vérifier</div>
      </div>

      <div className="zz-v-table-row">
        <div className="zz-v-avatar zz-v-avatar--teal">BT</div>
        <div className="zz-v-name">Touré Bakary</div>
        <div className="zz-v-pill zz-v-pill--ok">Auto</div>
      </div>

      <div className="zz-v-table-foot">1 845 associés automatiquement · 2 à vérifier</div>
    </div>
  )
}

export function ZzVisualNotify() {
  return (
    <div className="zz-visual zz-visual--notify">
      <div className="zz-v-chrome">
        <span className="zz-v-dot zz-v-dot--r" />
        <span className="zz-v-dot zz-v-dot--o" />
        <span className="zz-v-dot zz-v-dot--g" />
      </div>

      <div className="zz-v-notif">
        <div className="zz-v-notif-icon">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#27AE60" strokeWidth="2" aria-hidden>
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <div className="zz-v-notif-body">
          <div className="zz-v-notif-title">Bulletin de Mars disponible</div>
          <div className="zz-v-notif-meta">À l&apos;instant</div>
        </div>
      </div>

      <div className="zz-v-notif">
        <div className="zz-v-notif-icon">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#27AE60" strokeWidth="2" aria-hidden>
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <div className="zz-v-notif-body">
          <div className="zz-v-notif-title">Consulté par Koné A.</div>
          <div className="zz-v-notif-meta">Il y a 2 min</div>
        </div>
      </div>

      <div className="zz-v-phone">
        <div className="zz-v-phone-bar" />
        <div className="zz-v-phone-line zz-v-phone-line--muted" />
        <div className="zz-v-phone-line zz-v-phone-line--ok" />
        <div className="zz-v-phone-line zz-v-phone-line--ok" />
        <div className="zz-v-phone-line zz-v-phone-line--muted" />
        <div className="zz-v-phone-line zz-v-phone-line--ok" />
        <div className="zz-v-phone-stat">94% consultés</div>
      </div>
    </div>
  )
}
