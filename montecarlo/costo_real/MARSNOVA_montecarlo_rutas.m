%% MARSNOVA - MONTE CARLO: RUTA FIJA vs RUTA ADAPTATIVA
% Replica en MATLAB la simulación hecha con el código de la app
% (scripts/montecarlo.ts) para validarla de forma independiente.
%
% Entradas (en la misma carpeta que este script):
%   montecarlo_entrada.json  -> puntos (base + 12 candidatas), hipótesis,
%                               matrices COST y DIST_m (A* sobre la grilla de 10 m)
%   montecarlo_resumen.json  -> (opcional) resultados de la app para comparar
%
% Modelo (idéntico a la app):
%   - Una Beta(alpha, beta) por hipótesis y tipo de terreno; prior Beta(2,1).
%   - Sí -> alpha+1 ; No -> beta+1 ; Inconclusa -> sin cambio.
%   - Incertidumbre = desviación estándar de la Beta / 0,5 (máximo 1).
%   - Prioridad = sum(valor * incertidumbre) / (1 + COST/200) / (1 + 0,5*visitas_al_tipo),
%     sin repetir paradas.
% Experimento:
%   - theta verdadero ~ U(0,1; 0,9) por hipótesis y tipo, nuevo en cada misión.
%   - Respuesta: inconclusa con p = 0,15; si no, Sí con probabilidad theta.
%   - Ruta fija: vecino más cercano desde la base (por COST), saltando las
%     paradas que no caben en el presupuesto.
%   - Ruta adaptativa: la parada de mayor prioridad que quepa en el presupuesto.
%   - Presupuesto: distancia acumulada + regreso a la base <= presupuesto.
%   - Ambas estrategias usan los mismos theta y los mismos números aleatorios.
% No requiere toolboxes.

clearvars; clc; close all;

%% 1. PARÁMETROS
N            = 4000;                    % misiones por presupuesto (bajar a 500 para probar)
K            = 6;                       % paradas máximas por misión
P_INCONCLUSO = 0.15;
COSTO_REF    = 200;
LAMBDA       = 0.5;
presupuestos = [1500 2000 2500 3000 3500 4000 4500 5000 5500 6000 7000 8000];  % m
rng(2026, 'twister');

%% 2. LEER DATOS
E = jsondecode(fileread('montecarlo_entrada.json'));
P = E.puntos;   if iscell(P), P = [P{:}]; end
Hs = E.hipotesis; if iscell(Hs), Hs = [Hs{:}]; end
COST = E.COST;  DIST = E.DIST_m;
nP = numel(P);  nH = numel(Hs);  nT = 3;          % tipos 0,1,2 -> columnas 1,2,3

hipIds = {Hs.id};
valor  = [Hs.valor_cientifico];
alpha0 = zeros(nH, nT); beta0 = zeros(nH, nT); definida = false(nH, nT);
for h = 1:nH
    for t = Hs(h).tipos(:)'
        definida(h, t+1) = true; alpha0(h, t+1) = Hs(h).alpha0; beta0(h, t+1) = Hs(h).beta0;
    end
end

tipo = [P.tipo] + 1;                              % columna del tipo
esBase = false(1, nP); hipDe = cell(1, nP);
for j = 1:nP
    esBase(j) = isfield(P(j), 'es_base') && ~isempty(P(j).es_base) && logical(P(j).es_base);
    ids = P(j).hipotesis; if ischar(ids), ids = {ids}; end
    if isempty(ids), hipDe{j} = []; else, hipDe{j} = find(ismember(hipIds, ids)); end
end
base = find(esBase, 1);
cands = setdiff(1:nP, base);
w = repmat(valor(:), 1, nT) .* definida;  wSum = sum(w(:));
fprintf('Puntos: %d (base = %s). Hipótesis: %d. Celdas hipótesis x tipo: %d\n', nP, P(base).id, nH, nnz(definida));

%% 3. ORDEN FIJO: vecino más cercano desde la base
ordenFijo = zeros(1, numel(cands)); actual = base; quedan = cands;
for k = 1:numel(cands)
    [~, i] = min(COST(actual, quedan)); ordenFijo(k) = quedan(i); actual = quedan(i); quedan(i) = [];
end
fprintf('Orden fijo: %s\n', strjoin({P(ordenFijo(1:min(K,end))).id}, ' -> '));

incert = @(a, b) min(1, sqrt(a.*b ./ ((a+b).^2 .* (a+b+1))) / 0.5);

%% 4. SIMULACIÓN
nB = numel(presupuestos);
res = struct('presupuesto', num2cell(presupuestos), 'acF', 0, 'acA', 0, 'uF', 0, 'uA', 0, 'dF', 0, 'dA', 0, 'ganaA', 0);
for ib = 1:nB
    B = presupuestos(ib);
    acum = zeros(2, 4); gana = 0;                 % [acierto incert dist] por estrategia
    for n = 1:N
        theta = 0.1 + 0.8 * rand(nH, nT);
        estado = rng;                             % mismos números aleatorios para ambas
        out = zeros(2, 3);
        for est = 1:2                             % 1 = fija, 2 = adaptativa
            rng(estado);
            A = alpha0; Bt = beta0; visitado = false(1, nP); visTipo = zeros(1, nT);
            actual = base; dist = 0; posFijo = 1;
            for k = 1:K
                cabe = @(j) dist + DIST(actual, j) + DIST(j, base) <= B;
                sig = 0;
                if est == 1
                    while posFijo <= numel(ordenFijo) && ~cabe(ordenFijo(posFijo)), posFijo = posFijo + 1; end
                    if posFijo <= numel(ordenFijo), sig = ordenFijo(posFijo); posFijo = posFijo + 1; end
                else
                    score = -inf(1, numel(cands));
                    for c = 1:numel(cands)
                        j = cands(c);
                        if visitado(j) || j == actual, continue; end
                        hj = hipDe{j}; t = tipo(j);
                        info = sum(valor(hj) .* incert(A(hj, t)', Bt(hj, t)') .* definida(hj, t)');
                        score(c) = info / (1 + COST(actual, j) / COSTO_REF) / (1 + LAMBDA * visTipo(t));
                    end
                    [sOrd, ord] = sort(score, 'descend');   % sort es estable
                    for c = 1:numel(ord)
                        if sOrd(c) > 0 && cabe(cands(ord(c))), sig = cands(ord(c)); break; end
                    end
                end
                if sig == 0, break; end
                dist = dist + DIST(actual, sig); actual = sig;
                visitado(sig) = true; visTipo(tipo(sig)) = visTipo(tipo(sig)) + 1;
                t = tipo(sig);
                for h = hipDe{sig}
                    if ~definida(h, t), continue; end
                    if rand() < P_INCONCLUSO
                        % inconclusa: no cambia nada
                    elseif rand() < theta(h, t)
                        A(h, t) = A(h, t) + 1;
                    else
                        Bt(h, t) = Bt(h, t) + 1;
                    end
                end
            end
            media = A ./ (A + Bt);
            acierto = sum(w(:) .* ((media(:) > 0.5) == (theta(:) > 0.5)) .* definida(:)) / wSum;
            u = incert(A, Bt); u(~definida) = 0;
            out(est, :) = [acierto, sum(w(:) .* u(:)) / wSum, dist + DIST(actual, base)];
        end
        acum(:, 1:3) = acum(:, 1:3) + out / N;
        gana = gana + (out(2, 2) < out(1, 2));
    end
    res(ib).acF = acum(1,1); res(ib).acA = acum(2,1);
    res(ib).uF  = acum(1,2); res(ib).uA  = acum(2,2);
    res(ib).dF  = acum(1,3); res(ib).dA  = acum(2,3);
    res(ib).ganaA = gana / N;
    fprintf('%.1f km | acierto fija %.1f %%  adapt %.1f %% | incert fija %.3f  adapt %.3f | dist %.0f / %.0f m\n', ...
        B/1000, 100*res(ib).acF, 100*res(ib).acA, res(ib).uF, res(ib).uA, res(ib).dF, res(ib).dA);
end

%% 5. COMPARACIÓN CON LA APP (si está el archivo)
if isfile('montecarlo_resumen.json')
    S = jsondecode(fileread('montecarlo_resumen.json')); Rapp = S.resultados;
    if iscell(Rapp), Rapp = [Rapp{:}]; end
    fprintf('\n=== Diferencia con la app (puntos porcentuales de acierto) ===\n');
    for ib = 1:nB
        k = find([Rapp.presupuesto_m] == presupuestos(ib), 1);
        if isempty(k), continue; end
        fprintf('%.1f km | fija %+.1f  adapt %+.1f\n', presupuestos(ib)/1000, ...
            100*(res(ib).acF - Rapp(k).acierto_fija), 100*(res(ib).acA - Rapp(k).acierto_adaptativa));
    end
    fprintf('Con N = %d, diferencias de hasta ~1,5 puntos son ruido estadístico.\n', N);
end

%% 6. GRÁFICAS
km = presupuestos / 1000;
figure('Color', 'w', 'Position', [100 100 1100 420]);
subplot(1,2,1);
plot(km, 100*[res.acF], 'o-', 'Color', [0.55 0.56 0.6], 'LineWidth', 1.6); hold on;
plot(km, 100*[res.acA], 'o-', 'Color', [0.11 0.62 0.56], 'LineWidth', 1.6); grid on;
xlabel('Distancia máxima, ida y vuelta (km)'); ylabel('Decisiones correctas (%)');
title('¿Acierta si cada hipótesis se cumple?'); legend('Ruta fija', 'Ruta adaptativa', 'Location', 'southeast');
subplot(1,2,2);
plot(km, [res.uF], 'o-', 'Color', [0.55 0.56 0.6], 'LineWidth', 1.6); hold on;
plot(km, [res.uA], 'o-', 'Color', [0.11 0.62 0.56], 'LineWidth', 1.6); grid on;
xlabel('Distancia máxima, ida y vuelta (km)'); ylabel('Incertidumbre media (0-1)');
title('Incertidumbre al volver a la base'); legend('Ruta fija', 'Ruta adaptativa');
sgtitle(sprintf('MATLAB: %d misiones por punto', N));
exportgraphics(gcf, 'MARSNOVA_montecarlo_matlab.png', 'Resolution', 200);
writetable(struct2table(res), 'MARSNOVA_montecarlo_matlab.csv');
fprintf('\nListo: MARSNOVA_montecarlo_matlab.png y .csv\n');
