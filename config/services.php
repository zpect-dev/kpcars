<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    /*
    | Feed externo de multas (resolvetusmultas). Es un documento JSON con
    | snapshots diarios de la deuda por patente. Módulo experimental: la URL
    | (con su UUID de búsqueda) puede rotar, por eso vive en env.
    */
    'resolvetusmultas' => [
        'feed_url' => env(
            'MULTAS_FEED_URL',
            'https://api.resolvetusmultas.com/searches/201ef8c6-762a-47ee-9b9f-259cf45488af.json',
        ),
        // Verificación SSL. En algunos entornos locales de Windows falta el CA
        // bundle de curl; poné MULTAS_FEED_VERIFY_SSL=false ahí. En prod: true.
        'verify' => env('MULTAS_FEED_VERIFY_SSL', true),
    ],

];
