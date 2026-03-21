# PaySlip Manager

Application mobile et web de **gestion et distribution des bulletins de paie** — cahier des charges v1.0 (mars 2026).

## Structure du dépôt

| Dossier     | Rôle |
|------------|------|
| `backend/` | API NestJS (monolithe modulaire), Prisma, PostgreSQL, module **Storage** (S3 / MinIO) |
| `mobile/`  | Application React Native (Expo) — collaborateurs + admin mobile |
| `admin/`   | Dashboard web React + TypeScript (Vite) |

## Prérequis

- Node.js 20+
- Docker Desktop (pour Postgres, Redis, MinIO en local)
- Comptes développeur Apple / Google (pour les stores, phase déploiement)

## Démarrage rapide

### 1. Base de données et services

```bash
docker compose up -d
```

PostgreSQL du projet est exposé sur le port **5433** (pas 5432), pour ne pas entrer en conflit avec **Postgres.app** ou un autre PostgreSQL local qui écoute déjà sur 5432.

Créez le bucket S3 dans MinIO (console [http://localhost:9001](http://localhost:9001), identifiants alignés sur `.env.example`) : par ex. `payslip-manager`.

Puis appliquer les migrations Prisma :

```bash
cd backend
cp .env.example .env   # ou : cp ../.env.example .env
npm run prisma:migrate    # crée les tables (nommer la migration au prompt)
npm run prisma:generate
```

### 2. API

```bash
cd backend
npm install
npm run start:dev
```

Documentation OpenAPI : [http://localhost:3000/docs](http://localhost:3000/docs)

**Auth (préfixe `/api/v1`)** : `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `POST /auth/invite` (Bearer + RH_ADMIN), `POST /auth/activate`, `POST /auth/forgot-password`, `POST /auth/reset-password`. Les jetons invitation / reset sont stockés dans `Session` via `deviceInfo` (`INVITATION`, `PASSWORD_RESET`) ; les refresh JWT ont `deviceInfo: null`.  
`JwtAuthGuard` est **global** : toute route est protégée sauf si marquée `@Public()`.  
Pour restreindre par rôle, ajoutez **`@UseGuards(RolesGuard)`** sur le contrôleur ou la méthode, puis `@Roles('RH_ADMIN', 'SUPER_ADMIN', …)` et éventuellement `@CurrentUser()` pour lire `request.user` (type `RequestUser` dans `auth/auth.types.ts`).

**Utilisateurs (`/api/v1/users`)** : liste paginée (`GET /`, RH_ADMIN = son entreprise, SUPER_ADMIN = tous), création + invitation (`POST /`, RH_ADMIN), **import CSV/Excel** (`POST /import`, max 5 Mo, champs `matricule,prenom,nom,email,departement,poste`), **modèle** (`GET /import/template`), détail (`GET /:id`), `PATCH /:id`, `PATCH /:id/deactivate`, `PATCH /:id/reactivate`. Aucun `passwordHash` dans les réponses.

### 3. Application mobile

```bash
cd mobile
npm install
npx expo start
```

### 4. Dashboard administrateur

```bash
cd admin
npm install
npm run dev
```

## Modèle de données

Le schéma Prisma (`backend/prisma/schema.prisma`) reprend les entités du CDC : **Company**, **User** (rôles `SUPER_ADMIN`, `RH_ADMIN`, `EMPLOYEE`), **Payslip** (unicité `user + mois + année`), **AuditLog**, **Notification**, **Session**. Les PDF sont prévus côté stockage objet (MinIO / S3) ; le champ `file_url` stocke la clé ou l’URL métier selon votre implémentation.

## Périmètre fonctionnel (rappel)

- **Super Admin** : plateforme multi-entreprises (panel web).
- **RH Admin** : collaborateurs, upload unitaire / masse, stats, notifications push.
- **Collaborateur** : consultation PDF, téléchargement, historique, profil limité.

Sécurité cible : TLS, chiffrement au repos, JWT + refresh, RBAC, journalisation, conformité RGPD (à détailler en implémentation).

## Prochaines étapes techniques suggérées

1. Modules Nest : `auth`, `users`, `companies`, `payslips`, `notifications`, `storage`.
2. Intégration Redis (sessions / rate limit) et FCM (push).
3. Règles d’upload masse (`MATRICULE_MM_AAAA.pdf`) et rapports d’erreurs.
4. CI (GitHub Actions), environnements staging / production, sauvegardes (CDC §4.3).

---

*Document confidentiel — brouillon CDC v1.0.*
