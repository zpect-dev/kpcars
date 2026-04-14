<?php

namespace Database\Seeders;

use App\Models\Empresa;
use App\Models\Vehiculo;
use Illuminate\Database\Seeder;

class VehiculoSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $empresas = Empresa::pluck('id', 'nombre')->toArray();

        $data = [
            ['INV_01', 'AA589UJ', 'TOYOTA', 'ETIOS PLATINUM 1.5', '2016'],
            ['INV_01', 'AA526QE', 'TOYOTA', 'ETIOS XLS 1.5 6M/T', '2016'],
            ['INV_01', 'AD839ET', 'TOYOTA', 'ETIOS X 1.5 6M/T', '2019'],
            ['INV_01', 'PGX530', 'TOYOTA', 'ETIOS XS 1.5', '2015'],
            ['INV_01', 'AA516RD', 'TOYOTA', 'COROLLA XLI', '2016'],
            ['INV_01', 'AD108FF', 'TOYOTA', 'ETIOS X 1.5 6M/T', '2018'],
            ['INV_01', 'AA602OH', 'VOLKSWAGEN', 'POLO 1.6', '2016'],
            ['INV_01', 'AD352BH', 'TOYOTA', 'COROLLA 1.8 16V MT', '2018'],
            ['INV_01', 'KLO617', 'TOYOTA', 'COROLLA', '2011'],
            ['INV_01', 'PFZ091', 'TOYOTA', 'COROLLA XEI 1.8', '2016'],
            ['INV_02', 'AB677MU', 'TOYOTA', 'ETIOS XS 1.5 (TOYOTA)', '2017'],
            ['INV_02', 'AA810IV', 'TOYOTA', 'XLI 1.8 (CARWAY)', '2017'],
            ['INV_02', 'AC239WE', 'TOYOTA', 'ETIOS MARRÓN', '2017'],
            ['INV_02', 'POK161', 'TOYOTA', 'COROLLA XEI PACK', '2016'],
            ['INV_02', 'AA102ST', 'TOYOTA', 'COROLLA XLI', '2017'],
            ['INV_02', 'OTP961', 'TOYOTA', 'COROLLA XLI', '2015'],
            ['INV_02', 'PMA882', 'TOYOTA', 'COROLLA XEI 1.8', '2016'],
            ['INV_02', 'ORO664', 'TOYOTA', 'COROLLA XEI PACK 1.8', '2015'],
            ['INV_02', 'AB590DM', 'TOYOTA', 'COROLLA XLI 1.8', '2017'],
            ['INV_03', 'OKT149', 'TOYOTA', 'COROLLA XLI 1.8 6M/T', '2014'],
            ['INV_03', 'OHT763', 'TOYOTA', 'COROLLA XEI 1.8 CVT', '2014'],
            ['INV_03', 'OVI352', 'TOYOTA', 'COROLLA XEI 1.8 6M/T', '2015'],
            ['INV_03', 'PEQ294', 'TOYOTA', 'COROLLA XLI 1.8 CVT', '2015'],
            ['INV_03', 'OCJ368', 'TOYOTA', 'COROLLA SE-G 1.8 6M/T', '2014'],
            ['INV_03', 'POE557', 'TOYOTA', 'COROLLA XEI 1.8 6M/T', '2016'],
            ['INV_03', 'PPV074', 'TOYOTA', 'COROLLA XLI 1.8 6M/T', '2016'],
            ['INV_03', 'AA159ZP', 'TOYOTA', 'COROLLA XLI 1.8 6M/T', '2016'],
            ['INV_03', 'OGI467', 'TOYOTA', 'COROLLA XEI 1.8 CVT', '2014'],
            ['INV_03', 'PIK255', 'TOYOTA', 'COROLLA XLI 1.8 CVT', '2015'],
            ['INV_04', 'PIK853', 'TOYOTA', 'COROLLA XEI PACK 1.8 CVT', '2015'],
            ['INV_04', 'OTP781', 'TOYOTA', 'COROLLA XLI 1.8 6M/T 2015', '2015'],
            ['INV_04', 'OJH151', 'TOYOTA', 'COROLLA XEI 1.8 6M/T', '2014'],
            ['INV_04', 'OGM163', 'TOYOTA', 'COROLLA XEI PACK 1.8 6M/T', '2014'],
            ['INV_04', 'AA221BY', 'TOYOTA', 'COROLLA XEI 1.8 CVT', '2016'],
            ['INV_04', 'OBX010', 'TOYOTA', 'COROLLA XEI 1.8 6M/T', '2014'],
            ['INV_04', 'OMB591', 'TOYOTA', 'COROLLA XLI 1.8 CVT', '2015'],
            ['INV_04', 'NXI684', 'TOYOTA', 'COROLLA XEI 1.8 CVT', '2014'],
            ['INV_04', 'PIJ629', 'TOYOTA', 'COROLLA XLI 1.8 CVT', '2015'],
            ['INV_04', 'NWA849', 'TOYOTA', 'COROLLA XEI 1.8 6M/T', '2014'],
            ['INV_05', 'AB529LP', 'TOYOTA', 'COROLLA XLI 1.8 6M/T', '2017'],
            ['INV_05', 'AA909FU', 'TOYOTA', 'COROLLA XEI PACK 1.8 CVT', '2016'],
            ['INV_05', 'POM154', 'TOYOTA', 'COROLLA XLI 1.8 6M/T', '2016'],
            ['INV_05', 'OYU214', 'TOYOTA', 'COROLLA XEI PACK 1.8 CVT', '2015'],
            ['INV_05', 'AB446ED', 'TOYOTA', 'COROLLA XEI 1.8 6M/T', '2017'],
            ['INV_05', 'AC717FY', 'TOYOTA', 'COROLLA XEI PACK 1.8 6M/T', '2018'],
            ['INV_05', 'AA262EC', 'TOYOTA', 'COROLLA XEI PACK 1.8 6M/T', '2016'],
            ['INV_05', 'PBQ197', 'TOYOTA', 'COROLLA XEI 1.8 CVT', '2015'],
            ['INV_05', 'AB605LI', 'TOYOTA', 'COROLLA XEI PACK 1.8 CVT', '2017'],
            ['INV_05', 'AC542UG', 'TOYOTA', 'COROLLA XEI 1.8 6M/T', '2018'],
            ['INV_06', 'AC084BZ', 'TOYOTA', 'COROLLA XEI PACK 1.8 CVT', '2017'],
            ['INV_06', 'AA075RN', 'TOYOTA', 'COROLLA XEI PACK 1.8 CVT', '2016'],
            ['INV_06', 'AD183RG', 'TOYOTA', 'COROLLA XEI 1.8 6M/T', '2019'],
            ['INV_06', 'AD183ZO', 'TOYOTA', 'COROLLA XLI 1.8 CVT', '2018'],
            ['INV_06', 'OYY043', 'TOYOTA', 'COROLLA XEI 1.8 6M/T', '2015'],
            ['INV_06', 'AC925MT', 'TOYOTA', 'COROLLA XLI 1.8 6M/T', '2018'],
            ['INV_06', 'AA161XQ', 'TOYOTA', 'COROLLA XEI PACK 1.8 6M/T', '2016'],
            ['INV_06', 'AA029VZ', 'TOYOTA', 'COROLLA XEI 1.8 CVT', '2016'],
            ['INV_06', 'AB624EE', 'TOYOTA', 'COROLLA XLI 1.8 6M/T', '2017'],
            ['INV_06', 'AD330BO', 'TOYOTA', 'COROLLA XEI 1.8 6M/T', '2019'],
            ['INV_07', 'AC310FM', 'TOYOTA', 'COROLLA XEI 1.8 CVT', '2018'],
            ['INV_07', 'AA984PC', 'TOYOTA', 'COROLLA XEI PACK CVT', '2017'],
            ['INV_07', 'AD169TF', 'TOYOTA', 'COROLLA XEI 1.8 6M/T', '2018'],
            ['INV_07', 'PLE625', 'TOYOTA', 'COROLLA XEI PACK 1.8 CVT', '2016'],
            ['INV_07', 'PFL786', 'TOYOTA', 'COROLLA XEI PACK 1.8 CVT', '2015'],
            ['INV_07', 'AC222BA', 'TOYOTA', 'COROLLA XEI PACK 1.6 6M/T', '2018'],
            ['INV_07', 'AB995ID', 'TOYOTA', 'COROLLA XLI 1.8 6M/T', '2017'],
            ['INV_07', 'AD293XA', 'TOYOTA', 'COROLLA XEI PACK 1.8 CVT', '2018'],
            ['INV_07', 'ORT063', 'TOYOTA', 'COROLLA XLI 1.8 CVT', '2015'],
            ['INV_07', 'PLU493', 'TOYOTA', 'COROLLA XLI 1.8 6M/T', '2016'],
            ['INV_08', 'AA315FP', 'TOYOTA', 'COROLLA XEI PACK 1.8 6M/T', '2016'],
            ['INV_08', 'AB700BS', 'TOYOTA', 'COROLLA XEI 1.8 6M/T', '2017'],
            ['INV_08', 'AB956YS', 'TOYOTA', 'COROLLA XEI 1.8 CVT', '2017'],
            ['INV_08', 'AC391SW', 'TOYOTA', 'COROLLA XEI 1.8 CVT', '2018'],
            ['INV_08', 'AA930PX', 'TOYOTA', 'COROLLA', ''],
            ['INV_08', 'AA076BV', 'TOYOTA', 'COROLLA', ''],
            ['INV_08', 'PDQ566', 'TOYOTA', 'COROLLA', ''],
            ['INV_08', 'NZZ263', 'TOYOTA', 'COROLLA', ''],
            ['INV_08', 'AB528OQ', 'TOYOTA', 'COROLLA XLI 1.8 CVT', '2017'],
            ['INV_08', 'AD867LK', 'TOYOTA', 'COROLLA XEI 1.8 6M/T', '2019'],
            ['INV_09', 'OTH589', 'TOYOTA', 'COROLLA', ''],
            ['INV_09', 'NXQ647', 'TOYOTA', 'COROLLA', ''],
            ['INV_09', 'AA155AR', 'TOYOTA', 'COROLLA', ''],
            ['INV_09', 'NYO037', 'TOYOTA', 'COROLLA', ''],
            ['INV_09', 'AC700XV', 'TOYOTA', 'COROLLA', '2018'],
            ['INV_09', 'AC934TB', 'TOYOTA', 'COROLLA', ''],
            ['INV_09', 'AC849JI', 'TOYOTA', 'COROLLA', ''],
            ['INV_09', 'OQY425', 'TOYOTA', 'COROLLA', ''],
            ['INV_09', 'AB773YM', 'TOYOTA', 'COROLLA', ''],
        ];

        foreach ($data as $vehicle) {
            Vehiculo::create([
                'empresa_id' => $empresas[$vehicle[0]],
                'patente' => $vehicle[1],
                'marca' => $vehicle[2],
                'modelo' => $vehicle[3],
                'anio' => $vehicle[4] ?: 'N/A',
            ]);
        }
    }
}
