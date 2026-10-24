# Respiration and N2O model for six comic panels

Task nonce: respiration-six-panels-20261023-01
Status: implementation specification for numerical verification and independent review.

## Intended quantities
Six snapshots: initial end expiration, first end inspiration, second end expiration,
second end inspiration, third end expiration, third end inspiration. These labels
identify phase boundaries, not maximum voluntary lung capacities. Outputs describe
alveolar and conducting-airway gas, plus volume-weighted gas actually leaving the
mouth during each completed expiration. No pulse-oximeter readings or symptom
thresholds are inferred. End inspiration does not mean the whole lung contains
100% of the inspired gas.

## Primary academic basis
1. Korman, Dash & Peyton (2020), DOI 10.1152/japplphysiol.00049.2020,
   https://pmc.ncbi.nlm.nih.gov/articles/PMC8424544/
   Equation 1 links ventilation balance to Q * lambda * (Fa - Fv).
   Gas uptake changes the volume of gas left in the lung. Our transient integration
   uses this conservation relationship, not the paper's steady-state equations as
   if they were a published breath-cycle simulator.
2. Sandhu, Ritchie & Robbins (2021), DOI 10.1183/23120541.00858-2020,
   https://pmc.ncbi.nlm.nih.gov/articles/PMC8053910/
   Its abstract describes a reciprocally ventilated gas compartment and fixed
   incoming mixed-venous composition. This supports that model class; full-text
   retrieval was blocked, so no uninspected equation is attributed to it.
3. Magor-Elliott et al. (2021), DOI 10.1152/japplphysiol.00764.2020,
   https://pmc.ncbi.nlm.nih.gov/articles/PMC8354828/
   Equations 3-4 and the introduction establish the more complete body-store and
   circulatory-delay alternative. Our fixed-venous approximation omits those
   dynamics and must not inherit this paper's experimental validation.
4. Levitt (2002), DOI 10.1186/1471-2253-2-5,
   https://link.springer.com/article/10.1186/1471-2253-2-5
   Explains N2O distribution models, but explicitly excludes sub-minute kinetics
   for PKQuest. It is therefore not used as our short-time numerical solver.
5. Korman et al. (2023), DOI 10.14814/phy2.15822,
   https://pmc.ncbi.nlm.nih.gov/articles/PMC10624564/
   Gives the N2O Ostwald blood/gas coefficient 0.47 at 37 C.
6. Primary research examples for blood oxygen relations:
   https://pmc.ncbi.nlm.nih.gov/articles/PMC8405232/ (Eq 1, Severinghaus relation);
   https://pmc.ncbi.nlm.nih.gov/articles/PMC7654636/ (blood O2 content equation).

## Reduced model and units
Gas species i are O2, CO2, N2O and other inert gas. A_i is alveolar gas amount
expressed as litres at 37 C and dry-gas pressure Pb-PH2O. Its sum is the physical
alveolar volume V. Dry fractions are A_i/V and Pi = Fi*(Pb-PH2O).
Wet fractions are Fi*(Pb-PH2O)/Pb with water fraction PH2O/Pb.

A conducting airway is represented by configurable equal finite volumes totaling
0.15 L. Upwind transport moves gas in the appropriate direction without resetting
its composition at the change of breathing phase. Mouth flow is sinusoidal with
0.5 L inspired and 0.5 L expired over a five-second cycle. These volumes are
specified at the modeled warmed/humidified conditions. Uptake can make successive
end-expiratory volumes different; the calculation must not force the old volume
back by silently adding gas.

Gas conservation:
 dA_i/dt = transported_in_i - transported_out_i - U_i.
For N2O, U_N = Q * lambda * (F_A,N - F_v,N).
For O2, U_O = Q * [C_O(P_A,O)-C_O(P_v,O)] / k.
For CO2, U_C = Q * beta * (P_A,C-P_v,C) / k.
Here k = (Pb-PH2O)/760 * 273.15/310.15 converts the gas amount convention to
litres STPD. Q is litres blood/second. C_O is litres O2 STPD/litre blood:
 C_O(P) = [1.34*Hb*S(P) + 0.0031*P]/100,
 S(P) = (P^3+150*P)/(P^3+150*P+23400).
S is only an internal ideal capillary equilibrium relation, not an SpO2 prediction.
CO2 uses an explicitly approximate linear blood-content difference, not a complete
Bohr/Haldane chemistry model.

## Example parameters: assumptions rather than measurements of the avatar
Pb=760 mmHg; PH2O=47 mmHg; T=310.15 K; Q=5 L/min; Hb=15 g/dL;
initial alveolar PO2=100 mmHg and PCO2=40 mmHg; N2O initially zero;
total end-expiratory gas volume=2.5 L including 0.15 L conducting airway;
tidal mouth volume=0.5 L; breath period=5 s; N2O lambda=0.47.
Initial mixed venous PO2=40 mmHg, PCO2=46 mmHg, N2O fraction=0. These values evolve through the systemic store equations below.
CO2 beta = 0.2/(5*(46-40)) L STPD/litre blood/mmHg, chosen so the initial
CO2 transfer is 0.2 L STPD/min. This is calibration, not a published measured
constant. The example switches inspired dry gas to N2O without oxygen, matching
the hypothetical described in the conversation. It is not a use instruction.


This is a short, open-system gas mixing/uptake approximation with constant
incoming venous composition. It does not simulate tissue oxygen consumption
directly, evolving systemic blood stores, circulation delays, N2 back diffusion,
V/Q mismatch, breathing reflexes, airway collapse, pH changes or drug effects.
Existing systemic oxygen consumption is represented only indirectly by the chosen
incoming venous blood conditions; oxygen transfer can fall as alveolar PO2 falls.
A configurable nonzero venous N2O fraction tests sensitivity to recirculation.
The results are not a prediction of any individual's oxygenation. Reviewer
acceptance must specifically address whether this restricted model is sufficient
for approximate lung-composition illustration, and whether the selected horizon
and sensitivity checks make that scope acceptable. Do not use a steady-state
or fixed metabolic extraction assumption to invent blood saturation values.
## Systemic metabolism, storage and recirculation
The implementation evolves body stores; it does not hold mixed venous gas fixed.
A single mixed systemic reservoir is an approximation to the compartmental
conservation equations in Magor-Elliott et al., not a reproduction of its full
anatomical/delay model.

Let B=5 L systemic blood, W=41 L aqueous tissue, F=14 L adipose tissue.
These volumes are illustrative adult parameters, not measurements of the avatar.
Let bO = 133.322*(W*2.27e-7 + F*10.78e-7) L STPD/mmHg.
The coefficients are from Table 2 of Magor-Elliott et al.; 133.322 converts
mmHg to Pa. Oxygen body store is X_O(Pv)=B*C_O(Pv)+bO*Pv.
Its conservation equation is dX_O/dt = k*U_O - metabolic_O2.
After updating the store, the monotonic nonlinear relation is inverted to obtain
the new returning venous PO2. Default oxygen metabolism is calibrated to the
initial lung/blood pressure difference at the chosen Q and Hb. This is about
a resting adult value and remains constant across the short example.

For CO2, bC = B*beta + 133.322*(W*1.54e-5 + F*1.05e-5).
X_C=bC*PvCO2 and dX_C/dt=k*U_C+metabolic_CO2.
The blood/tissue CO2 reservoir is a linear effective-buffer approximation around
normal pH; it omits full Bohr/Haldane coupling. Production is 0.2 L STPD/min.

N2O capacity is D_N = B*lambda_b + W*lambda_water + F*lambda_fat.
X_N is gas-equivalent litres; Fv_N=X_N/D_N and dX_N/dt=U_N.
The water/air coefficient 0.47 and lipid/air 1.4 are reported by Levitt for N2O.
Using those for aqueous/adipose aggregate compartments is an explicit reduction,
not a measurement of every organ partition. As N2O accumulates, Fv_N increases
and reduces later net lung uptake. Metabolism, external inflow and external
outflow all enter the whole-system conservation ledger.

No circulation-time delay is added to this lumped model. Blood mixing and store
dynamics are represented by the coupled state variables, not by an unchanged
venous boundary. The independent reviewer must assess the accuracy appropriate
to a qualitative comic with approximate gas-composition overlays.

## Scope and acceptance
The model includes conducting-airway gas, an expanding/contracting alveolar gas
compartment, pressure-dependent blood O2 transfer, approximate buffered CO2
transfer, continued systemic O2 consumption/CO2 production and N2O recirculation.
It excludes V/Q heterogeneity, explicit vascular transit paths, N2 back diffusion,
full pH/Bohr/Haldane dynamics, ventilation reflexes, airway collapse and drug
pharmacodynamics. No SpO2 or confusion threshold is exported. Numerical and
sensitivity checks and independent review must precede illustration acceptance.

## Execution
Node 22, no npm dependencies:
 node --test workspaces/meta-instructor/tasks/respiration-six-panels/model.test.cjs
 node workspaces/meta-instructor/tasks/respiration-six-panels/model.cjs
The executable emits the six snapshots, gas balances, systemic-state information,
sensitivity runs and a CSV representation as JSON. Task-specific GitHub workflow
respiration-model.yml publishes exact test output and results to Issue 7.
