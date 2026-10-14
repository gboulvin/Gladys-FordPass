# FordPass

Intègre vos véhicules Ford dans Gladys : niveau de carburant ou de batterie,
autonomie, kilométrage, verrouillage, alarme, portes et vitres, pression des
pneus, position, et les commandes à distance de l'application FordPass
(verrouiller, déverrouiller, démarrage à distance, charge).

> Cette intégration utilise les mêmes serveurs que l'application mobile
> FordPass. Ford ne propose pas d'API publique pour cela : Ford peut la
> modifier à tout moment, et l'intégration peut alors nécessiter une mise à
> jour.

## Prérequis

- Un compte FordPass avec votre ou vos véhicules ajoutés et **activés** dans
  l'application FordPass (les services connectés doivent être activés).
- Un ordinateur avec un navigateur de bureau (Chrome, Edge, Firefox…) pour la
  connexion, à faire une seule fois.

## Connecter votre compte

Ford vous connecte sur sa propre page puis tente d'ouvrir l'application
FordPass. Un navigateur ne peut pas ouvrir l'application : vous copiez donc
l'adresse finale à la main. Cela prend deux minutes, une seule fois.

1. Dans Gladys, ouvrez l'onglet **Configuration** de l'intégration et
   choisissez la **région** de votre compte FordPass. Enregistrez.
2. Ouvrez les **outils de développement** du navigateur (`F12`, ou
   `Ctrl+Maj+I` / `Cmd+Option+I` sur Mac) et sélectionnez l'onglet
   **Réseau**. Laissez-le ouvert.
3. Cliquez sur **Connecter** à côté de _Compte Ford_. La page de connexion
   Ford s'ouvre : connectez-vous avec l'e-mail et le mot de passe de votre
   compte FordPass (et le code envoyé par Ford, s'il est demandé).
4. La page semble alors charger indéfiniment : c'est normal. Dans l'onglet
   **Réseau**, trouvez la requête dont l'adresse commence par
   `fordapp://userauthorized/?code=` (tapez `code=` dans le filtre). Clic
   droit → **Copier** → **Copier l'URL**. Dans Firefox, l'adresse peut
   apparaître plutôt dans la console sous forme d'erreur (« ouverture
   empêchée ») : copiez-la depuis là.
5. De retour dans Gladys, lancez l'action **Terminer la connexion** et collez
   l'adresse. Faites-le tout de suite : le code n'est valable que quelques
   minutes, et la connexion doit être terminée dans les 10 minutes suivant le
   clic sur **Connecter**.
6. La réponse liste les véhicules trouvés. Ouvrez l'onglet **Découverte** et
   ajoutez-les.

Votre mot de passe ne transite jamais par Gladys : l'intégration ne reçoit
qu'un code à usage unique, échangé contre des jetons enregistrés dans la
configuration de l'intégration. Ford maintient la session pendant des mois ;
si elle expire (mot de passe changé, inutilisée trop longtemps), l'écran de
configuration l'indique : refaites les étapes ci-dessus.

## Le véhicule dans Gladys

Chaque véhicule est un appareil. Ses fonctionnalités dépendent de sa
motorisation :

| Fonctionnalité                                  | Essence / diesel / hybride | Électrique / hybride rechargeable |
| ----------------------------------------------- | :------------------------: | :-------------------------------: |
| Kilométrage                                     |             ✓              |                 ✓                 |
| Niveau de carburant, autonomie carburant        |             ✓              |   ✓ (hybride rechargeable seul)   |
| Charge de la batterie, autonomie électrique     |                            |                 ✓                 |
| Charge en cours (pilotable), branché, puissance |                            |                 ✓                 |
| Batterie 12 V                                   |             ✓              |                 ✓                 |
| Verrouillage (pilotable)                        |             ✓              |                 ✓                 |
| Alarme armée                                    |             ✓              |                 ✓                 |
| Porte ouverte, vitre ouverte                    |             ✓              |                 ✓                 |
| Démarrage à distance (pilotable)                |             ✓              |                 ✓                 |
| Durée de vie de l'huile                         |             ✓              |   ✓ (hybride rechargeable seul)   |
| Température extérieure                          |             ✓              |                 ✓                 |
| Pression de chaque pneu                         |             ✓              |                 ✓                 |

Une valeur que votre véhicule ne remonte pas reste simplement vide.

La fonctionnalité **Verrouillage** verrouille (allumé) et déverrouille
(éteint) le véhicule, **Démarrage à distance** démarre le moteur ou la
climatisation de pré-conditionnement (allumé) ou l'arrête (éteint), **Charge
en cours** lance ou arrête la charge. Ford transmet une commande à la voiture
en 10 à 60 secondes ; la fonctionnalité affiche ensuite l'état confirmé par
la voiture.

## Réglages

- **Intervalle de rafraîchissement** : fréquence de lecture de chaque
  véhicule (5 minutes par défaut, 1 minute au minimum). La lecture récupère
  seulement ce que les serveurs Ford connaissent déjà : elle ne réveille
  jamais la voiture et ne vide pas sa batterie. La voiture envoie elle-même
  de nouvelles valeurs quand elle roule, est verrouillée, se charge…
- **Unité de distance** et **unité de pression des pneus**.
- **Seuil carburant / batterie bas** : le niveau qui lance le déclencheur de
  scène _Carburant ou batterie bas_ (15 % par défaut).
- **Langue des noms de fonctionnalités** : anglais, français, allemand ou
  espagnol, appliquée à l'ajout d'un véhicule dans Gladys.

## Actions

- **Terminer la connexion** — voir ci-dessus.
- **Tester la connexion** — liste les véhicules du compte.
- **Se déconnecter de Ford** — supprime les jetons enregistrés. Les véhicules
  restent dans Gladys avec leur historique.

## Scènes

L'intégration ajoute ses propres cartes à l'éditeur de scènes (Gladys 5.1 ou
plus récent).

Déclencheurs :

- **Carburant ou batterie bas** — le niveau est passé sous le seuil
  configuré. Filtrez sur le véhicule et l'énergie (carburant, batterie).
  Variables : `{{triggerEvent.data.energy}}`, `{{triggerEvent.data.level}}`.
- **Alarme déclenchée** — l'alarme antivol s'est déclenchée. Variables :
  `latitude` et `longitude` du véhicule.
- **Alerte pression des pneus** — la surveillance de pression a signalé une
  roue. Variables : `wheel` (ex. `rear_left`), `pressure`.
- **Charge terminée** — un véhicule électrique ou hybride rechargeable a fini
  de charger. Variables : `level`, `range`.
- **Contact mis ou coupé** — début ou fin de trajet. Filtrez sur _Mis_ /
  _Coupé_. Variables : `state`, `odometer`.

Les fonctionnalités de l'appareil fonctionnent aussi avec le déclencheur
standard _Un appareil change d'état_ (ex. « Verrouillage passe à 0 »).

Actions :

- **Envoyer une commande à un véhicule Ford** — verrouiller, déverrouiller,
  démarrer à distance, arrêter le démarrage à distance, lancer ou arrêter la
  charge, ou actualiser les données (celle-ci réveille le véhicule : limitée à
  24 par jour). Sorties : `success` et `status`, pour que les actions
  suivantes vérifient que la voiture a obéi.
- **Lire l'état d'un véhicule Ford** — les dernières valeurs connues de Ford,
  utilisables par les actions suivantes : `odometer`, `fuel_level`,
  `battery_level`, `range`, `locked`, `doors_open`, `windows_open`,
  `charging`, `latitude`, `longitude`.

Exemple : _tous les soirs à 22 h → lire l'état du véhicule → si `locked` est
faux → envoyer la commande « Verrouiller » et une notification_.

## Tableau de bord

- **Véhicule Ford** — choisissez un véhicule : énergie, autonomie et
  kilométrage en direct, l'état du verrouillage, de l'alarme, des portes, des
  vitres, des pneus et de la charge, l'heure de la dernière mise à jour, et
  des boutons pour verrouiller, déverrouiller (avec confirmation), actualiser
  et ouvrir la position sur une carte.
- **Véhicules Ford** — tous les véhicules du compte avec leur niveau, leur
  autonomie, leur verrouillage et un lien vers la carte.

## Dépannage

- **« Ford a refusé la connexion »** : le code a expiré ou a déjà servi.
  Cliquez de nouveau sur **Connecter** et collez tout de suite la nouvelle
  adresse. Vérifiez la région.
- **« Aucune connexion en cours »** : plus de 10 minutes se sont écoulées
  depuis le clic sur **Connecter** : cliquez de nouveau.
- **Aucun véhicule trouvé** : le véhicule doit être ajouté et activé dans
  l'application FordPass avec le même compte.
- **« Vehicle not authorized »** dans les logs : acceptez de nouveau les
  services connectés dans l'application FordPass.
- **Une commande échoue** : le véhicule peut être en veille profonde
  (inutilisé depuis des jours, batterie 12 V faible), hors couverture mobile,
  ou refuser la commande (démarrage à distance avec une porte ouverte,
  alarme…). Le widget affiche « Commandes suspendues » pendant une veille
  profonde.
- **Les valeurs ne bougent pas** : la voiture n'envoie de nouvelles valeurs
  que lorsqu'elle est utilisée ; lancez _Actualiser_ depuis le widget pour
  lui en demander.

Les logs de l'intégration (Gladys → Intégrations → FordPass) ne contiennent
jamais vos jetons ni votre mot de passe.
