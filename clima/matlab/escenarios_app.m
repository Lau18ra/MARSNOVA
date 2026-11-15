%% escenarios_app.m
% Resume los condiciones_<escenario>.json (salida de mcd_condiciones.m)
% en un solo archivo para la app: escenarios.json
%
% Por escenario y por mes (30° de Ls) guarda mínimos, máximos y medias.
% Uso en la app:
%   - base   : climatología de la web MCD (climatologia_web.json, de mcd_web.m)
%   - rango  : cold / warm  -> incertidumbre ("entre X y Y")
%   - alerta : strm         -> tormenta de polvo (solo Ls 180–360)
%   - años   : MY24, MY25, MY26 -> variación entre años reales
%
% Ejecutar DESPUÉS de mcd_condiciones.m (con los arreglos de tau y horas).

clear; clc;

% Carpeta 'clima' (la que contiene matlab/, datos_crudos/ y salidas/)
raiz = fileparts(fileparts(mfilename('fullpath')));
if isempty(raiz), raiz = '/Users/laurarengifo/Desktop/SpaceApps2026/clima'; end
carpeta    = fullfile(raiz, 'salidas', 'json');
escenarios = {'MY24', 'MY25', 'MY26', 'cold', 'warm', 'strm'};
descripcion = struct( ...
    'MY24', 'Año marciano 24 (1998–2000), polvo observado', ...
    'MY25', 'Año marciano 25 (2000–2002), incluye la tormenta global de 2001', ...
    'MY26', 'Año marciano 26 (2002–2004), polvo observado', ...
    'cold', 'Poco polvo y Sol en mínimo: cielo despejado, noches más frías', ...
    'warm', 'Mucho polvo y Sol en máximo: días menos cálidos, noches más templadas', ...
    'strm', 'Tormenta de polvo (solo Ls 180–360)');

salida = struct();
salida.sitio  = 'Monte Sharp, cráter Gale (zona del DTM HiRISE)';
salida.fuente = 'Mars Climate Database v6.2 (.nc), interpolación bilineal al centro de la zona';
salida.uso    = struct('rango', {{'cold', 'warm'}}, 'alerta', 'strm', ...
                       'anios', {{'MY24', 'MY25', 'MY26'}});
salida.escenarios = struct();

for e = 1:numel(escenarios)
    esc = escenarios{e};
    f = fullfile(carpeta, sprintf('condiciones_%s.json', esc));
    if ~isfile(f), fprintf('Falta %s, se omite.\n', f); continue, end
    d = jsondecode(fileread(f));
    hl = d.hora_local(:);
    dt = median(diff(sort(hl)));          % paso entre horas (2 h en los .nc)

    meses = d.meses;
    res = struct([]);
    for k = 1:numel(meses)
        m = meses(k);
        if isfield(m, 'ps_corregida_ciclo_pa'), ps = m.ps_corregida_ciclo_pa;
        else,                                  ps = m.ps_ciclo_pa; end
        sol = m.sol_ciclo_wm2(:);
        [~, iMax] = max(m.tsurf_ciclo_c);

        res(k).ls              = m.ls(:)';
        res(k).tsurf_min_c     = round(min(m.tsurf_ciclo_c), 1);
        res(k).tsurf_max_c     = round(max(m.tsurf_ciclo_c), 1);
        res(k).hora_tsurf_max  = round(hl(iMax), 1);
        res(k).taire_min_c     = round(min(m.taire_ciclo_c), 1);
        res(k).taire_max_c     = round(max(m.taire_ciclo_c), 1);
        res(k).tau_media       = round(mean(m.tau_ciclo), 2);
        res(k).tau_max         = round(max(m.tau_ciclo), 2);
        res(k).sol_max_wm2     = round(max(sol), 0);
        res(k).horas_luz       = sum(sol > 1) * dt;
        res(k).ps_min_pa       = round(min(ps), 0);
        res(k).ps_max_pa       = round(max(ps), 0);
        res(k).viento_max_ms   = round(max(m.viento_ciclo_ms), 1);
    end
    salida.escenarios.(esc) = struct('descripcion', descripcion.(esc), 'meses', res);
    fprintf('%s: %d meses\n', esc, numel(res));
end

archivo = fullfile(carpeta, 'escenarios.json');
fid = fopen(archivo, 'w');
fprintf(fid, '%s', jsonencode(salida, 'PrettyPrint', true));
fclose(fid);
fprintf('Listo: %s\n', archivo);
