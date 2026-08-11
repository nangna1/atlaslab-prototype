-- Permission de telechargement de la piece jointe de lecon (2026-08-11,
-- demande utilisateur : "donne a son auteur l'option de controle de
-- permission d'autoriser ou non le telechargement du document televerse aux
-- apprenants"). Defaut a true : les pieces jointes deja deposees restent
-- telechargeables comme avant cette migration, comportement inchange sauf
-- action explicite du professeur.
--
-- Important a noter (pas une vraie protection technique) : le bucket
-- storage "lecons-documents" est PUBLIC (voir 20260729000000_lecons_document_
-- joint.sql) - n'importe qui avec l'URL directe peut deja recuperer le
-- fichier, avec ou sans ce flag. Cette colonne controle uniquement si
-- l'application AFFICHE le bouton de telechargement a l'apprenant, pas un
-- controle d'acces cryptographique au fichier lui-meme.
alter table lessons
  add column piece_jointe_telechargeable boolean not null default true;
