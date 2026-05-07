#!/bin/bash
# Fetch and preview many seeds, pick cohesive set
cd "$(dirname "$0")/../assets/avatars"
mkdir -p /tmp/avatar_candidates
SEEDS_PIERRE="SirHenry1 OldGent2 Maurice4 Edmond7 Bernard9 Gustave3 ColonelP TheBaron"
SEEDS_SOPHIE="LadyDiane MadameC1 Ms.Lily9 SophieR3 Aurore22 IsabelleM"
SEEDS_MARC="MarcoDeux RogueX BeardJim Pirate7 SailorM Frederic9 Ricky2"
SEEDS_VOUS="VousMec OldMeBeard Capitaine BernardSenior LeChef"

for seed in $SEEDS_PIERRE $SEEDS_SOPHIE $SEEDS_MARC $SEEDS_VOUS; do
  curl -sL --max-time 15 "https://api.dicebear.com/9.x/notionists/svg?seed=$seed&backgroundColor=f4e8d0,e0c987&backgroundType=gradientLinear" -o "/tmp/avatar_candidates/$seed.svg"
done
ls /tmp/avatar_candidates/ | wc -l
