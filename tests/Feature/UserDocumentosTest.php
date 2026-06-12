<?php

declare(strict_types=1);

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

beforeEach(function () {
    Storage::fake('public');

    $this->admin = User::factory()->create([
        'role' => UserRole::ADMINISTRADOR,
        'dni' => '80000001',
    ]);

    $this->actingAs($this->admin);
});

it('crea un usuario con licencia en PDF y DNI en imágenes (frente y dorso)', function () {
    $this->post('/users', [
        'name' => 'Chofer Documentado',
        'dni' => '80009001',
        'role' => 'chofer',
        'licencia_pdf' => UploadedFile::fake()->create('licencia.pdf', 100, 'application/pdf'),
        'dni_frente' => UploadedFile::fake()->image('dni-frente.jpg'),
        'dni_dorso' => UploadedFile::fake()->image('dni-dorso.jpg'),
    ])->assertRedirect();

    $user = User::where('dni', '80009001')->first();

    expect($user->licencia_pdf_path)->not->toBeNull()
        ->and($user->licencia_frente_path)->toBeNull()
        ->and($user->dni_pdf_path)->toBeNull()
        ->and($user->dni_frente_path)->not->toBeNull()
        ->and($user->dni_dorso_path)->not->toBeNull();

    Storage::disk('public')->assertExists($user->licencia_pdf_path);
    Storage::disk('public')->assertExists($user->dni_frente_path);
    Storage::disk('public')->assertExists($user->dni_dorso_path);
});

it('rechaza una imagen de documento sin su otra cara', function () {
    $this->from('/users')->post('/users', [
        'name' => 'Chofer Incompleto',
        'dni' => '80009002',
        'role' => 'chofer',
        'dni_frente' => UploadedFile::fake()->image('dni-frente.jpg'),
        // falta dni_dorso
    ])->assertSessionHasErrors('dni_dorso');

    expect(User::where('dni', '80009002')->exists())->toBeFalse();
});

it('rechaza mezclar PDF e imágenes en el mismo documento', function () {
    $this->from('/users')->post('/users', [
        'name' => 'Chofer Mixto',
        'dni' => '80009003',
        'role' => 'chofer',
        'licencia_pdf' => UploadedFile::fake()->create('licencia.pdf', 100, 'application/pdf'),
        'licencia_frente' => UploadedFile::fake()->image('lic-frente.jpg'),
    ])->assertSessionHasErrors('licencia_pdf');

    expect(User::where('dni', '80009003')->exists())->toBeFalse();
});

it('al reemplazar un PDF por imágenes elimina el PDF anterior', function () {
    // Estado inicial: licencia en PDF.
    $this->post('/users', [
        'name' => 'Chofer Cambia Formato',
        'dni' => '80009004',
        'role' => 'chofer',
        'licencia_pdf' => UploadedFile::fake()->create('licencia.pdf', 100, 'application/pdf'),
    ])->assertRedirect();

    $user = User::where('dni', '80009004')->first();
    $pdfViejo = $user->licencia_pdf_path;
    expect($pdfViejo)->not->toBeNull();

    // Ahora se cargan imágenes para la misma licencia.
    $this->post("/users/{$user->id}", [
        '_method' => 'put',
        'name' => $user->name,
        'dni' => $user->dni,
        'licencia_frente' => UploadedFile::fake()->image('lic-frente.jpg'),
        'licencia_dorso' => UploadedFile::fake()->image('lic-dorso.jpg'),
    ])->assertRedirect();

    $user->refresh();

    expect($user->licencia_pdf_path)->toBeNull()
        ->and($user->licencia_frente_path)->not->toBeNull()
        ->and($user->licencia_dorso_path)->not->toBeNull();

    Storage::disk('public')->assertMissing($pdfViejo);
});

it('expone las URLs de documentos vía el accessor documentos', function () {
    $this->post('/users', [
        'name' => 'Chofer URL',
        'dni' => '80009005',
        'role' => 'chofer',
        'dni_frente' => UploadedFile::fake()->image('dni-frente.jpg'),
        'dni_dorso' => UploadedFile::fake()->image('dni-dorso.jpg'),
    ])->assertRedirect();

    $user = User::where('dni', '80009005')->first();

    expect($user->documentos['dni']['frente'])->toBeString()->not->toBeNull()
        ->and($user->documentos['dni']['dorso'])->toBeString()->not->toBeNull()
        ->and($user->documentos['dni']['pdf'])->toBeNull()
        ->and($user->documentos['licencia']['frente'])->toBeNull();

    // El listado no debe filtrar las rutas crudas (están en $hidden).
    $this->get('/users?role=chofer&status=activos')
        ->assertOk()
        ->assertInertia(fn ($page) => $page->component('Users/Index')->has('users'));
});
