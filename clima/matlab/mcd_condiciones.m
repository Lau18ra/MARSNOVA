%% mcd_condiciones.m
% Condiciones ambientales de la Mars Climate Database (MCD v6.2, archivos .nc)
% interpoladas al centro de la zona de trabajo, para varios escenarios.
%
% Entrada : datos_crudos/MCD/<escenario>/<prefijo>_<mes>_me.nc
%           salidas/json/elevacion_zona.json (opcional, de dem_gale.m)
% Salidas : salidas/json/condiciones_<escenario>.json
%           salidas/figuras/comparacion_escenarios.png
%           salidas/figuras/ciclo_diario_<escenario>.png
%
% Notas:
% - La malla de la MCD es de ~3.75° x 5.625°: toda la zona cabe en una celda,
%   así que se interpola (bilineal) al centro de la zona.
% - El eje "Time" de los .nc es hora universal marciana (en longitud 0);
%   la hora local en la zona es Time + lon/15 (horas marcianas).
% - La presión del .nc corresponde a la elevación media del modelo; si existe
%   elevacion_zona.json se agrega una presión corregida aproximada.

clear; clc;

%% Configuración
% Carpeta 'clima' (la que contiene matlab/, datos_crudos/ y salidas/)
raiz = fileparts(fileparts(mfilename('fullpath')));
if isempty(raiz), raiz = '/Users/laurarengifo/Desktop/SpaceApps2026/clima'; end
carpetaMCD = fullfile(raiz, 'datos_crudos', 'MCD');
salidaJSON = fullfile(raiz, 'salidas', 'json');
salidaFig  = fullfile(raiz, 'salidas', 'figuras');
escenarios = {'MY24', 'MY25', 'MY26', 'cold', 'warm', 'strm'};

% Zona de trabajo (DTM HiRISE), planetocéntrica, longitud este 0–360
latC = (-4.948844 + -4.720558)/2;
lonC = (137.238958 + 137.353924)/2;

if ~exist(salidaJSON, 'dir'), mkdir(salidaJSON); end
if ~exist(salidaFig,  'dir'), mkdir(salidaFig);  end

% Factor de corrección de presión (opcional)
archivoElev = fullfile(salidaJSON, 'elevacion_zona.json');
if isfile(archivoElev)
    elev = jsondecode(fileread(archivoElev));
    factorPresion = elev.factor_presion;
    fprintf('Usando factor de presión %.3f (de dem_gale.m)\n', factorPresion);
else
    factorPresion = NaN;
    fprintf('Sin elevacion_zona.json: no se corrige la presión.\n');
end

%% Procesar cada escenario
res = struct();
for e = 1:numel(escenarios)
    esc = escenarios{e};
    carpeta = fullfile(carpetaMCD, esc);
    if ~exist(carpeta, 'dir')
        fprintf('Falta la carpeta %s, se omite.\n', esc); continue
    end
    prefijo = detectarPrefijo(carpeta);
    fprintf('Procesando %s (prefijo "%s")...\n', esc, prefijo);
    [meses, horaUT] = procesarEscenario(carpeta, prefijo, lonC, latC, factorPresion);
    if isempty(meses)
        fprintf('  %s no tiene meses válidos, se omite.\n', esc); continue
    end
    horaLocal = mod(horaUT(:)' + lonC/15, 24);
    res.(esc) = meses;

    salida = struct('sitio', 'Monte Sharp, cráter Gale', 'escenario', esc, ...
        'punto_interpolado', [latC lonC], ...
        'hora_local', round(horaLocal, 2), ...
        'fuente', 'Mars Climate Database v6.2 (.nc), interpolación bilineal', ...
        'meses', meses);
    fid = fopen(fullfile(salidaJSON, sprintf('condiciones_%s.json', esc)), 'w');
    fprintf(fid, '%s', jsonencode(salida, 'PrettyPrint', true));
    fclose(fid);

    graficarCicloDiario(meses, horaLocal, esc, ...
        fullfile(salidaFig, sprintf('ciclo_diario_%s.png', esc)));
end

%% Comparación entre escenarios
nombres = fieldnames(res);
if isempty(nombres), error('No se procesó ningún escenario.'); end
metricas = {@(m) m.tsurf_max_c, @(m) m.tsurf_min_c, @(m) mean(m.tau_ciclo)};
titulos  = {'Temperatura máxima de superficie (°C)', ...
            'Temperatura mínima de superficie (°C)', 'Opacidad media del polvo'};
fig = figure('Position', [100 100 1300 420]);
tiledlayout(1, 3, 'TileSpacing', 'compact');
for p = 1:3
    nexttile; hold on
    for e = 1:numel(nombres)
        meses = res.(nombres{e});
        ls = arrayfun(@(m) mean(m.ls), meses);
        y  = arrayfun(metricas{p}, meses);
        plot(ls, y, '-o', 'LineWidth', 1.5, 'DisplayName', nombres{e});
    end
    xlim([0 360]); xticks(0:90:360); grid on
    xlabel('Ls (°)'); title(titulos{p})
end
legend('Location', 'bestoutside')
exportgraphics(fig, fullfile(salidaFig, 'comparacion_escenarios.png'), 'Resolution', 200);
fprintf('Listo.\n');

%% ---------- Funciones locales ----------
function prefijo = detectarPrefijo(carpeta)
    d = dir(fullfile(carpeta, '*_me.nc'));
    d = d(~contains({d.name}, 'thermo'));
    if isempty(d), error('No hay archivos *_me.nc en %s', carpeta); end
    tok = regexp(d(1).name, '^(.*)_\d{2}_me\.nc$', 'tokens', 'once');
    prefijo = tok{1};
end

function [meses, horaUT] = procesarEscenario(carpeta, prefijo, lonC, latC, factorPresion)
    meses = struct([]);
    horaUT = [];
    P = [];
    for m = 1:12
        f = fullfile(carpeta, sprintf('%s_%02d_me.nc', prefijo, m));
        if ~isfile(f), continue, end
        if isempty(P)
            [lonv, ilon] = sort(mod(double(ncread(f, 'longitude')), 360));
            [latv, ilat] = sort(double(ncread(f, 'latitude')));
            horaUT = double(ncread(f, 'Time'));
            P = {lonv, latv, ilon, ilat, lonC, latC};
        end
        ts  = interpArr(double(ncread(f, 'tsurf')), P{:}) - 273.15;
        ps  = interpArr(double(ncread(f, 'ps')), P{:});
        tau = interpArr(double(ncread(f, 'tau_pref_gcm')), P{:});
        sol = interpArr(double(ncread(f, 'fluxsurf_dn_sw')), P{:});
        co2 = interpArr(double(ncread(f, 'co2ice')), P{:});
        ta  = interpArr(capaBaja(ncread(f, 'temp')), P{:}) - 273.15;
        u   = interpArr(capaBaja(ncread(f, 'u')), P{:});
        v   = interpArr(capaBaja(ncread(f, 'v')), P{:});

        k = numel(meses) + 1;
        meses(k).mes             = m;
        meses(k).ls              = [30*(m-1) 30*m];
        meses(k).tsurf_ciclo_c   = round(ts, 1);
        meses(k).taire_ciclo_c   = round(ta, 1);
        meses(k).ps_ciclo_pa     = round(ps, 1);
        if ~isnan(factorPresion)
            meses(k).ps_corregida_ciclo_pa = round(ps * factorPresion, 1);
        end
        meses(k).tau_ciclo       = round(tau .* ps / 610, 3);   % opacidad local aprox.
        meses(k).sol_ciclo_wm2   = round(sol, 1);
        meses(k).viento_ciclo_ms = round(hypot(u, v), 1);
        meses(k).co2ice_ciclo    = round(co2, 4);
        meses(k).tsurf_min_c     = round(min(ts), 1);
        meses(k).tsurf_max_c     = round(max(ts), 1);
    end
end

function A = capaBaja(A)
    A = double(squeeze(A(:, :, 1, :)));      % capa del modelo más cercana a la superficie
end

function v = interpArr(A, lonv, latv, ilon, ilat, lonC, latC)
    A = A(ilon, ilat, :);
    v = zeros(1, size(A, 3));
    for h = 1:size(A, 3)
        F = griddedInterpolant({lonv, latv}, A(:, :, h), 'linear');
        v(h) = F(lonC, latC);
    end
end

function graficarCicloDiario(meses, horaLocal, esc, archivo)
    [lt_s, k] = sort(horaLocal(:));
    x = [lt_s; lt_s(1) + 24];                 % cierra el ciclo del día
    colores = hsv(numel(meses));
    campos  = {'tsurf_ciclo_c', 'taire_ciclo_c', 'sol_ciclo_wm2', ...
               'tau_ciclo', 'ps_ciclo_pa', 'viento_ciclo_ms'};
    titulos = {'Temperatura de superficie (°C)', 'Temperatura del aire, capa baja (°C)', ...
               'Radiación solar en superficie (W/m²)', 'Opacidad del polvo (local)', ...
               'Presión en superficie (Pa)', 'Viento cerca de la superficie (m/s)'};
    fig = figure('Position', [100 100 1300 700]);
    tl = tiledlayout(2, 3, 'TileSpacing', 'compact');
    for p = 1:numel(campos)
        nexttile; hold on
        for m = 1:numel(meses)
            y = meses(m).(campos{p})(:);
            plot(x, y([k; k(1)]), 'LineWidth', 1.2, 'Color', colores(m, :), ...
                 'DisplayName', sprintf('Ls %d–%d', meses(m).ls));
        end
        xlim([0 24]); xticks(0:6:24); grid on
        title(titulos{p}); xlabel('Hora solar local (h)')
    end
    lg = legend('Orientation', 'vertical'); lg.Layout.Tile = 'east';
    title(tl, sprintf('Condiciones en la zona de trabajo – MCD v6.2, escenario %s', esc))
    exportgraphics(fig, archivo, 'Resolution', 200);
end
