# RodTransfert

Site de transfert de fichiers façon WeTransfer, en **HTML, CSS et JavaScript pur**.
Glisser-déposer, jusqu'à **3 Go** par transfert, lien de partage instantané.

## Fonctionnalités

- Glisser-déposer n'importe où sur la page (fichiers **et dossiers**), clic pour parcourir, ou Ctrl+V
- Limite de 3 Go avec jauge en temps réel
- Progression circulaire, vitesse et temps restant
- Annulation de l'envoi en cours
- Lien de partage : copier, ouvrir, partager (mobile)
- Historique des 5 derniers transferts (stocké dans le navigateur)
- Responsive mobile / desktop

## Structure

```
rodtransfert/
├── index.html                  page principale
├── README.md
├── .nojekyll                   GitHub Pages sert les fichiers tels quels
└── assets/
    ├── css/style.css           design
    ├── js/script.js            logique (sélection, envoi, historique)
    └── img/
        ├── favicon.svg         icône d'onglet
        ├── apple-touch-icon.png icône écran d'accueil mobile
        ├── logo.svg            logo complet
        └── og-image.png        aperçu lors du partage du lien (1200×630)
```

## Mise en ligne sur GitHub Pages

1. Créer un dépôt (ex. `rodtransfert`) et y pousser les 3 fichiers à la racine.
2. Dans le dépôt : **Settings → Pages → Source : Deploy from a branch → `main` / `(root)`**.
3. Le site est disponible sur `https://<ton-pseudo>.github.io/rodtransfert/`.

## Où vont les fichiers ?

GitHub Pages n'héberge que des fichiers statiques : il ne peut pas recevoir d'upload.
Les fichiers sont donc envoyés directement depuis le navigateur vers l'API publique
**Gofile** (gratuite, sans compte), qui renvoie le lien de téléchargement.
Plusieurs fichiers d'un même transfert sont regroupés dans un seul dossier, donc un seul lien.

À savoir : sur l'offre gratuite de Gofile, les fichiers inactifs peuvent être supprimés
au bout d'un certain temps. Pour changer de service, il suffit de modifier
`UPLOAD_URL` et la fonction `uploadOne()` dans `script.js`.
