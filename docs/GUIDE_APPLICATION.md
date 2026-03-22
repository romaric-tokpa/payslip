# PaySlip Manager — Guide de l’application (bout en bout)

Ce document décrit **l’objectif du produit**, **l’architecture**, les **rôles**, les **parcours** et les **fonctionnalités** des différentes parties du dépôt (API, admin web, app mobile, landing).

---

## 1. Vue d’ensemble

**PaySlip Manager** est une solution de **gestion et distribution des bulletins de paie** pour les entreprises. Elle permet aux **équipes RH / paie** de :

- structurer les **collaborateurs** et l’**organisation** (directions, départements, services) ;
- **importer** des collaborateurs en masse et les **activer** ;
- **déposer** les fiches de paie (PDF), y compris en **lot** avec analyse automatique ;
- suivre l’**activité** via le **tableau de bord** et les **journaux d’audit**.

Les **collaborateurs** consultent leurs bulletins sur **l’application mobile** (connexion par matricule / mot de passe), avec notifications et suivi de lecture.

Une **landing page** marketing (admin, route publique) présente l’offre ; l’**espace admin** est protégé après authentification.

---

## 2. Architecture technique

| Composant | Technologie | Rôle |
|-----------|-------------|------|
| **API** | NestJS, Prisma, PostgreSQL | Logique métier, auth JWT (access + refresh), fichiers, emails, limites de débit |
| **Admin web** | React (Vite), Ant Design | Interface RH / administrateur |
| **Mobile** | Expo / React Native, React Navigation, React Native Paper | Consultation bulletins et profil pour les employés |
| **Stockage fichiers** | Service type S3 (configurable) | PDF des bulletins, photos de profil, logos |
| **Email** | Module dédié | Invitations, réinitialisation de mot de passe, messages d’activation |

Les applications **admin** et **mobile** consomment la **même API** (URL configurée par variables d’environnement).

---

## 3. Rôles et statuts métier

### 3.1 Rôles (`UserRole`)

- **SUPER_ADMIN** — périmètre plateforme (selon implémentation des garde-fous).
- **RH_ADMIN** — administrateur paie / RH au sein d’une **entreprise** : gestion utilisateurs, bulletins, organisation, audit.
- **EMPLOYEE** — collaborateur : accès principalement **mobile** aux bulletins et au profil.

### 3.2 Statut d’emploi (`EmploymentStatus`)

Exemples : **PENDING** (importé, pas encore activé), **ACTIVE**, **ON_NOTICE**, **DEPARTED** (compte gelé côté usage normal), **ARCHIVED** (après rétention).

Un collaborateur **DEPARTED** peut conserver un **accès lecture seule** sur le mobile jusqu’à une date **`readOnlyUntil`**, selon la politique de l’entreprise (ex. jours configurables après départ sur la fiche société).

### 3.3 Types de contrat et départ

Contrats : CDI, CDD, intérim, stage. Les **départs** peuvent être typés (démission, licenciement, fin de contrat, etc.) avec dates de préavis et traçabilité (**qui** a enregistré le départ).

---

## 4. Modèle de données (synthèse)

- **Company** — entreprise (RCCM, adresse, logo, plan d’abonnement, paramètres comme jours d’accès lecture seule après départ).
- **Direction → Department → Service** — hiérarchie organisationnelle (avec API « arbre » et résolution à l’import).
- **User** — identité, email unique, matricule (`employeeId`) par entreprise, rattachement dept/service, mot de passe, photo de profil (clé stockage), statuts contrat / départ, `mustChangePassword`, etc.
- **Payslip** — un bulletin par **utilisateur + mois + année** (unicité), fichier en stockage, taille, auteur d’upload, **lu / non lu** (`isRead`, `readAt`).
- **AuditLog** — actions tracées (qui, quoi, entité, métadonnées, IP, user-agent).
- **Notification** — notifications côté utilisateur (titres, messages, type, lu/non lu).
- **Session** — sessions refresh côté serveur pour la révocation / multi-appareils.

---

## 5. Parcours bout en bout

### 5.1 Première utilisation côté entreprise (admin)

1. **Inscription / invitation** selon les flux prévus (`register`, `invite`, `activate` côté auth).
2. Un **RH_ADMIN** se connecte à l’admin (`/login`), accède au **dashboard**.
3. Configuration progressive : **organigramme** (directions, départements, services), puis **collaborateurs** (création unitaire ou **import** Excel/CSV avec mapping, résolution d’organisations, validation, commit).
4. **Activation** des comptes (y compris **activation en masse** et envoi de messages / emails selon configuration).
5. **Dépôt des bulletins** : fichier par fichier ou **bulk** (analyse des PDF, correspondance employés, confirmation).
6. Les **employés** ouvrent l’**app mobile**, se connectent (**login employé**), voient la liste des bulletins, ouvrent le PDF ; la plateforme peut marquer la **consultation** et émettre des **notifications**.

### 5.2 Collaborateur (mobile)

1. Connexion (identifiant type **matricule** + mot de passe).
2. Si **changement de mot de passe obligatoire** : écran dédié avant l’accès aux onglets.
3. Onglets typiques : **Accueil** (résumé, dernier bulletin, raccourcis), **Bulletins** (liste, détail, téléchargement / partage selon implémentation), **Profil** (infos, notifications, changement de mot de passe).
4. Collaborateur **parti** : bannière **lecture seule** et accès limité dans le temps si configuré.

---

## 6. Application admin web (fonctionnalités)

Routes protégées sous le préfixe **`/dashboard`** (constante `ADMIN_BASE`).

### 6.1 Authentification publique

- Connexion, inscription, mot de passe oublié, réinitialisation avec jeton.

### 6.2 Dashboard

- **Statistiques** agrégées (`/dashboard/stats`) : vue synthétique de l’activité (effectifs, bulletins, tendances selon implémentation du DTO).

### 6.3 Collaborateurs (`/dashboard/employees`)

- Liste / recherche / filtres, vues type **table** ou **kanban** (ex. par département).
- **Création / édition** de fiche, désactivation, réactivation.
- **Départ** (enregistrement du type, dates, motif) et **réintégration** si prévu.
- **Archivage** pour la fin de cycle de vie.
- **Invitation** (renvoi d’invitation par email selon endpoint).
- **Contrats qui expirent** : consultation des profils à surveiller.
- **Import** dédié (`/dashboard/employees/import`) : étapes de mapping, prévisualisation, résolution d’organisations, validation, commit ; import **asynchrone** possible avec suivi par job / événements.
- **Activation en masse** et configuration **messagerie** d’activation.
- **Template** d’import téléchargeable.

### 6.4 Bulletins de paie (`/dashboard/payslips` et `/dashboard/payslips/upload`)

- Liste des bulletins (filtres, périodes, états).
- **Upload simple** : choix du collaborateur + période + fichier.
- **Upload en masse** : analyse des noms de fichiers / contenu PDF, rapprochement avec les employés, relecture avant **confirmation** en lot.
- Téléchargement, marquage lu (côté API), suppression selon droits.

### 6.5 Organisation / organigramme (`/dashboard/orgchart`)

- Visualisation de l’**arbre** ou du **graphe** organisationnel.
- Gestion des **directions, départements, services** (CRUD).
- Outils avancés : **résolution** des libellés importés vers la structure réelle, **création en masse** d’entités d’org.

### 6.6 Audit (`/dashboard/audit`)

- Liste des **journaux d’audit** avec filtres.
- Liste des **actions** référencées.
- **Export** des logs (ex. conformité / contrôle interne).

### 6.7 Paramètres (`/dashboard/settings`)

- Profil / entreprise / préférences selon les écrans implémentés (ex. société « me », utilisateur « me », photo de profil).

### 6.8 Landing marketing (`/`, `/landing`)

- Page vitrine (sections produit, tarifs, témoignages, CTA, footer) ; **sans** accès aux données métier.

---

## 7. Application mobile (fonctionnalités)

- **Splash** puis restauration de session ou écran **login**.
- **Mot de passe oublié** (stack auth).
- **Onglet Accueil** : chargement des stats bulletins, dernier bulletin, notifications récentes, raccourcis vers bulletins et profil.
- **Onglet Bulletins** : liste paginée, ouverture d’un PDF (WebView ou viewer), marquage consultation via API.
- **Onglet Profil** : informations compte, **notifications**, **changement de mot de passe**, déconnexion.
- **Notifications push** : enregistrement d’appareil côté API si configuré ; badge non lus sur l’onglet bulletins selon API **unread-count**.
- Gestion des erreurs réseau / **403** / session expirée (rafraîchissement ou retour login).

---

## 8. API — modules principaux (aperçu)

| Module | Responsabilité |
|--------|----------------|
| **Auth** | Login admin / employé, refresh, logout, register, invite, activate, forgot/reset password, changement de mot de passe, sessions |
| **Users** | CRUD / filtres collaborateurs, `me`, import multi-étapes, activation masse, départs / réintégration / archive, photo de profil |
| **Companies** | Mise à jour **me** (fiche société connectée) |
| **Organization** | CRUD directions / départements / services, **chart** |
| **Org** (contrôleur complémentaire) | **Tree**, **resolve**, **bulk-create** pour l’import et l’UI avancée |
| **Payslips** | Upload, bulk + analyze + confirm, liste, détail, download, marquer lu, suppression |
| **Notifications** | Liste, lu, non lus, envoi, enregistrement appareil |
| **Audit** | Consultation, export, référentiel d’actions |
| **Dashboard** | Statistiques |
| **Health** | Santé de l’API |
| **Storage** | Abstraction upload / URL signées (bulletins, profils, logos) |
| **Email** | Envoi des mails transactionnels |

La sécurité repose sur l’**authentification JWT**, le **scope entreprise** (les RH ne voient que leur société), le **throttling** global, et des **interceptors** / **pipes** communs (journalisation, sanitization).

---

## 9. Bonnes pratiques opérationnelles (résumé)

- Importer d’abord une **structure organisationnelle** cohérente pour faciliter le **mapping** à l’import des collaborateurs.
- Utiliser le **flux bulk** des bulletins quand les fichiers suivent une convention de nommage ou contiennent des métadonnées exploitables par l’extracteur PDF.
- Consulter l’**audit** en cas d’incident ou d’exigence de traçabilité.
- Paramétrer **`readOnlyDaysAfterDeparture`** au niveau entreprise pour aligner le **mobile** sur la politique de conservation d’accès des anciens salariés.

---

## 10. Emplacement du code (repères)

- **API** : `backend/src/` (modules par dossier), schéma Prisma : `backend/prisma/schema.prisma`.
- **Admin** : `admin/src/` (pages, services, router, layouts).
- **Mobile** : `mobile/src/` (screens, navigation, services, contexts).
- **Landing** : `admin/src/pages/landing/`.

---

*Document généré à partir de la structure du dépôt ; il peut être complété au fil des évolutions fonctionnelles.*
