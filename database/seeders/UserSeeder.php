<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

class UserSeeder extends Seeder
{
    /**
     * Seed the users table.
     * Password formula: first letter of name (uppercase) + DNI
     */
    public function run(): void
    {
        $users = [
            ['name' => 'JOSE LARA', 'dni' => '19122958'],
            ['name' => 'JUAN VARGAS', 'dni' => '29960819'],
            ['name' => 'LEONARDO RAMIREZ', 'dni' => '96119387'],
            ['name' => 'JOAQUIN GUERRA', 'dni' => '42955589'],
            ['name' => 'FEDERICO MASCIOTRA', 'dni' => '43090499'],
            ['name' => 'MICHELLE PINTO', 'dni' => '96483739'],
            ['name' => 'EDWARD CASTELLANOS', 'dni' => '95952148'],
            ['name' => 'EDUARDO GONZALEZ', 'dni' => '96005255'],
            ['name' => 'WILLIAM MENDO', 'dni' => '95089000'],
            ['name' => 'SEBASTIAN LEIVA', 'dni' => '26105077'],
            ['name' => 'ROGER ALMARAL', 'dni' => '95922227'],
            ['name' => 'HENRY FIERRO', 'dni' => '96452903'],
            ['name' => 'DAVID BOSSY', 'dni' => '41394784'],
            ['name' => 'JORGE CARPIO', 'dni' => '96369629'],
            ['name' => 'EDWIN QUIROZ', 'dni' => '95531740'],
            ['name' => 'JUAN CARLOS GIL', 'dni' => '95793957'],
            ['name' => 'GASTON PEREZ', 'dni' => '32112948'],
            ['name' => 'MARIANO MIRANDA', 'dni' => '31409381'],
            ['name' => 'MARCEL MORENO', 'dni' => '95929965'],
            ['name' => 'SERGIO RUIZ', 'dni' => '96140747'],
            ['name' => 'LUCAS CABRERA', 'dni' => '39550214'],
            ['name' => 'DANIEL ALVAREZ', 'dni' => '95932892'],
            ['name' => 'FRANKLIN JIMENEZ', 'dni' => '95611319'],
            ['name' => 'NICOLAS BRUN', 'dni' => '96516061'],
            ['name' => 'JOSE ROMERO', 'dni' => '96041352'],
            ['name' => 'RAINER LOPEZ', 'dni' => '96012222'],
            ['name' => 'DANIEL FERNANDEZ', 'dni' => '96254870'],
            ['name' => 'ROMMER CORDERO', 'dni' => '96327954'],
            ['name' => 'JORGE GANDULIA', 'dni' => '28906980'],
            ['name' => 'GABRIEL TORRES', 'dni' => '96400776'],
            ['name' => 'HECTOR PINEDA', 'dni' => '96235269'],
            ['name' => 'JUAN PABLO JORDAN', 'dni' => '19065803'],
            ['name' => 'JULIO SANTONI', 'dni' => '95958818'],
            ['name' => 'DIEGO TOVAR', 'dni' => '969066579'],
            ['name' => 'JUAN CARLOS DIAZ', 'dni' => '96451450'],
            ['name' => 'JOAN TORREGLOSA', 'dni' => '95760555'],
            ['name' => 'NICOLAS PAULINA', 'dni' => '41576698'],
            ['name' => 'ORIANA GARCIA', 'dni' => '95942249'],
            ['name' => 'DARREN GAZUL', 'dni' => '94334316'],
            ['name' => 'ABIEZER GALINDO', 'dni' => '95954985'],
            ['name' => 'ROIBERT GUERRERO', 'dni' => '96077996'],
            ['name' => 'JORGE PINEDA', 'dni' => '96004135'],
            ['name' => 'RICARDO PEREIRA', 'dni' => '93028687'],
            ['name' => 'PATRICIO BONARDI', 'dni' => '32438639'],
            ['name' => 'DANIEL ROSS', 'dni' => '95845360'],
            ['name' => 'ANGEL SUAREZ', 'dni' => '95747841'],
            ['name' => 'MARIO ROLANDO', 'dni' => '22245762'],
            ['name' => 'FRANCO BARBIERI', 'dni' => '40835167'],
            ['name' => 'MARIO MARTINEZ', 'dni' => '95922901'],
            ['name' => 'FULVIO MATA', 'dni' => '96467795'],
            ['name' => 'VERONICA LUQUE', 'dni' => '32187682'],
            ['name' => 'MIGUEL ANGEL GONZÁLEZ', 'dni' => '30066766'],
            ['name' => 'CHRISTIAN VAN WAGENINGEN', 'dni' => '23567555'],
            ['name' => 'DARWIN ANTONIO GIL SILVA', 'dni' => '96254887'],
            ['name' => 'JEREMIAS GABRIEL SCHNEIDER', 'dni' => '45281590'],
            ['name' => 'JEORGE NORMAN LOPEZ TORRES', 'dni' => '95904224'],
            ['name' => 'JOSE BELTRAN GUILARTE SANCHEZ', 'dni' => '95955204'],
            ['name' => 'TEOFILO ANTONIO GIL GOMEZ', 'dni' => '96146166'],
            ['name' => 'DANESY PINZON', 'dni' => '96308511'],
            ['name' => 'ROXANA FUENTES', 'dni' => '96062796'],
            ['name' => 'ANGEL MERCADO', 'dni' => '96257482'],
            ['name' => 'JESUS MONASTERIOS', 'dni' => '96326397'],
            ['name' => 'ANGEL MAI', 'dni' => '35495331'],
            ['name' => 'PABLO ESCOBAR', 'dni' => '96001191'],
            ['name' => 'EMANUEL GONZÁLEZ', 'dni' => '40671289'],
            ['name' => 'DANIEL HORACIO BOYE', 'dni' => '23203264'],
            ['name' => 'ELIONAR SANCHEZ', 'dni' => '24540789'],
            ['name' => 'JORGE BOSSY', 'dni' => '96125271'],
            ['name' => 'MARCELO NUÑEZ', 'dni' => '96107678'],
            ['name' => 'FRANCISCO COTIS', 'dni' => '95676369'],
            ['name' => 'GUSTAVO PRIETO', 'dni' => '96213602'],
            ['name' => 'GABRIEL GUERRA', 'dni' => '96015181'],
            ['name' => 'CARMEN GIL', 'dni' => '96256456'],
            ['name' => 'FRANCISCO DUN', 'dni' => '19127307'],
        ];

        foreach ($users as $userData) {
            $firstLetter = mb_strtoupper(mb_substr($userData['name'], 0, 1));
            $password = $firstLetter . $userData['dni'];

            User::updateOrCreate(
                ['dni' => $userData['dni']],
                [
                    'name'     => $userData['name'],
                    'password' => $password, // cast 'hashed' in model handles bcrypt
                ],
            );
        }
    }
}
