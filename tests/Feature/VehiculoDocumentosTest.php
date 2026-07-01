<?php

declare(strict_types=1);

use App\Enums\UserRole;
use App\Models\Empresa;
use App\Models\Inversion;
use App\Models\User;
use App\Models\Vehiculo;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

beforeEach(function () {
    Storage::fake('public');

    $this->empresa = Empresa::create(['nombre' => 'Empresa Docs']);
    $this->inversion = Inversion::create(['nombre' => 'Inv Docs', 'empresa_id' => $this->empresa->id]);

    $this->admin = User::factory()->create([
        'role' => UserRole::ADMINISTRADOR,
        'dni' => '40000001',
        'empresa_default_id' => $this->empresa->id,
    ]);

    $this->actingAs($this->admin);
    session(['active_company_id' => $this->empresa->id]);

    $this->vehiculo = Vehiculo::create([
        'patente' => 'DOC100',
        'marca' => 'Toyota',
        'modelo' => 'Etios',
        'anio' => '2020',
        'precio' => 360000,
        'inversion_id' => $this->inversion->id,
        'empresa_id' => $this->empresa->id,
    ]);
});

it('guarda cédula en imágenes, título en PDF y seguro con vencimiento', function () {
    $this->post("/vehiculos/{$this->vehiculo->id}/documentos", [
        'cedula_frente' => UploadedFile::fake()->image('ced-frente.jpg'),
        'cedula_dorso' => UploadedFile::fake()->image('ced-dorso.jpg'),
        'titulo_pdf' => UploadedFile::fake()->create('titulo.pdf', 100, 'application/pdf'),
        'seguro' => UploadedFile::fake()->create('seguro.pdf', 100, 'application/pdf'),
        'seguro_vencimiento' => '2027-03-15',
    ])->assertRedirect();

    $this->vehiculo->refresh();

    expect($this->vehiculo->cedula_frente_path)->not->toBeNull()
        ->and($this->vehiculo->cedula_dorso_path)->not->toBeNull()
        ->and($this->vehiculo->cedula_pdf_path)->toBeNull()
        ->and($this->vehiculo->titulo_pdf_path)->not->toBeNull()
        ->and($this->vehiculo->seguro_path)->not->toBeNull()
        ->and($this->vehiculo->seguro_vencimiento->toDateString())->toBe('2027-03-15');

    Storage::disk('public')->assertExists($this->vehiculo->cedula_frente_path);
    Storage::disk('public')->assertExists($this->vehiculo->titulo_pdf_path);
    Storage::disk('public')->assertExists($this->vehiculo->seguro_path);
});

it('permite subir una sola cara de cédula (se completa más adelante)', function () {
    $this->from('/dashboard')->post("/vehiculos/{$this->vehiculo->id}/documentos", [
        'cedula_frente' => UploadedFile::fake()->image('ced-frente.jpg'),
    ])->assertSessionHasNoErrors();

    $this->vehiculo->refresh();
    expect($this->vehiculo->cedula_frente_path)->not->toBeNull()
        ->and($this->vehiculo->cedula_dorso_path)->toBeNull();
});

it('rechaza mezclar PDF e imágenes en el título', function () {
    $this->from('/dashboard')->post("/vehiculos/{$this->vehiculo->id}/documentos", [
        'titulo_pdf' => UploadedFile::fake()->create('titulo.pdf', 100, 'application/pdf'),
        'titulo_frente' => UploadedFile::fake()->image('tit-frente.jpg'),
    ])->assertSessionHasErrors('titulo_pdf');
});

it('reemplaza el archivo de seguro y elimina el anterior', function () {
    $this->post("/vehiculos/{$this->vehiculo->id}/documentos", [
        'seguro' => UploadedFile::fake()->create('seguro-v1.pdf', 100, 'application/pdf'),
    ])->assertRedirect();

    $this->vehiculo->refresh();
    $viejo = $this->vehiculo->seguro_path;
    expect($viejo)->not->toBeNull();

    $this->post("/vehiculos/{$this->vehiculo->id}/documentos", [
        'seguro' => UploadedFile::fake()->image('seguro-v2.jpg'),
    ])->assertRedirect();

    $this->vehiculo->refresh();
    expect($this->vehiculo->seguro_path)->not->toBe($viejo);
    Storage::disk('public')->assertMissing($viejo);
});

it('expone las URLs y el vencimiento vía el accessor documentos', function () {
    $this->post("/vehiculos/{$this->vehiculo->id}/documentos", [
        'cedula_frente' => UploadedFile::fake()->image('ced-frente.jpg'),
        'cedula_dorso' => UploadedFile::fake()->image('ced-dorso.jpg'),
        'seguro' => UploadedFile::fake()->create('seguro.pdf', 100, 'application/pdf'),
        'seguro_vencimiento' => '2027-01-10',
    ])->assertRedirect();

    $this->vehiculo->refresh();
    $docs = $this->vehiculo->documentos;

    expect($docs['cedula']['frente'])->toBeString()
        ->and($docs['cedula']['pdf'])->toBeNull()
        ->and($docs['titulo']['frente'])->toBeNull()
        ->and($docs['seguro']['archivo'])->toBeString()
        ->and($docs['seguro']['es_pdf'])->toBeTrue();
});
