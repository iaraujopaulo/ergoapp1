// This file handles the display of pose landmark information

import { 
  posicaoOmbro, 
  verificarOmbrosElevados, 
  verificarAbducaoOmbro, 
  verificarBracoApoiado, 
  calcularPontuacaoRulaOmbro, 
  calcularAnguloAntebraco, 
  verificarCruzaLinhaMedia, 
  calcularPontuacaoRulaAntebraco, 
  calcularAnguloPunho,
  verificarDesvioPunho, 
  calcularPontuacaoRulaPunho, 
  avaliacaoParcial, 
  calcularPontuacaoPescoco, 
  calcularPontuacaoTronco,
  verificarRotacaoLateralizacaoPescoco,
  verificarRotacaoLateralizacaoTronco,
  classificarPontuacaoRulaMemSup,
  classificarPontuacaoRulaMemInfTronco,
  classificarTotalPontuacaoRula 
 } from './rulaFunctions.js';

import { wristPostureScore } from './wristPostureScoreDic.js';
import { trunkPostureScoreDictionary } from './trunkPostureScoreDic.js';
import { finalScoreDictionary } from './finalScoreDic.js';



// Create and display landmark information below the canvas
export function displayLandmarkInfo(landmarks, imageElement_width, imageElement_height) {

  // Check if form already exists
  let formContainer = document.getElementById('ergonomicAssessment');
  if (!formContainer) {
    formContainer = document.createElement('div');
    formContainer.id = 'ergonomicAssessment';
    formContainer.className = 'rula-analysis';
    document.getElementById('demos').appendChild(formContainer);
  }
  
  formContainer.style.display = 'block';
  formContainer.innerHTML = `
    <h3><i class="fas fa-clipboard-list"></i> Pontuações Adicionais</h3>
    <form id="ergonomicForm">
      <div class="form-group">
        <label for="adc_atv_musc"><strong>Pontuação Adicional para Atividade Muscular (Braços):</strong></label>
        <select id="adc_atv_musc" class="form-control">
          <option value="Nenhum">Nenhum</option>
          <option value="Postura estática (+ que 1 minuto)">Postura estática (+ que 1 minuto)</option>
          <option value="Ação repetida (4 ou mais vezes por minuto)">Ação repetida (4 ou mais vezes por minuto)</option>
        </select>
      </div>
      
      <div class="form-group">
        <label for="adc_for_carg"><strong>Pontuação Adicional para Uso de Força ou Carga (Braços):</strong></label>
        <select id="adc_for_carg" class="form-control">
          <option value="Ausente ou menor que 2kg (Intermitente)">Ausente ou menor que 2kg (Intermitente)</option>
          <option value="Entre 2 e 10Kg (Intermitente)">Entre 2 e 10Kg (Intermitente)</option>
          <option value="Entre 2 e 10Kg (Estático ou Mais que 4 vezes por minuto)">Entre 2 e 10Kg (Estático ou Mais que 4 vezes por minuto)</option>
          <option value="Maior que 10Kg">Maior que 10Kg</option>
        </select>
      </div>
      
      <div class="form-group">
        <label for="posi_d_pern"><strong>Posicionamento das Pernas:</strong></label>
        <select id="posi_d_pern" class="form-control">
          <option value="Pernas e pés apoiados e equilibrados">Pernas e pés apoiados e equilibrados</option>
          <option value="Pernas e pés não estão apoiados e/ou equilibrados">Pernas e pés não estão apoiados e/ou equilibrados</option>
        </select>
      </div>
      
      <div class="form-group">
        <label for="adc_atv_musc_pern"><strong>Pontuação Adicional para Atividade Muscular (Pernas):</strong></label>
        <select id="adc_atv_musc_pern" class="form-control">
          <option value="Nenhum">Nenhum</option>
          <option value="Postura estática (+ que 1 minuto)">Postura estática (+ que 1 minuto)</option>
          <option value="Ação repetida (4 ou mais vezes por minuto)">Ação repetida (4 ou mais vezes por minuto)</option>
        </select>
      </div>
      
      <div class="form-group">
        <label for="adc_for_carg_pern"><strong>Pontuação Adicional para Uso de Força ou Carga (Pernas):</strong></label>
        <select id="adc_for_carg_pern" class="form-control">
          <option value="Ausente ou menor que 2kg (Intermitente)">Ausente ou menor que 2kg (Intermitente)</option>
          <option value="Entre 2 e 10Kg (Intermitente)">Entre 2 e 10Kg (Intermitente)</option>
          <option value="Entre 2 e 10Kg (Estático ou Mais que 4 vezes por minuto)">Entre 2 e 10Kg (Estático ou Mais que 4 vezes por minuto)</option>
          <option value="Maior que 10Kg">Maior que 10Kg</option>
        </select>
      </div>
      
      <div class="form-group">
        <label for="frame_info" id="frame_label" style="display: none;"><strong>Frame Information:</strong></label>
        <input type="text" id="frame_info" class="form-control" style="display: none;" readonly>
      </div>
      
      <button type="submit" class="control-button" style="margin-top: 15px;">Enviar Avaliação</button>
    </form>
    <div id="wristDataContainer"></div>
  `;
  
  // Show frame info field if video mode is active
  if (document.getElementById('videoControls').style.display === 'block') {
    document.getElementById('frame_label').style.display = 'block';
    document.getElementById('frame_info').style.display = 'block';
    
    // Get current frame info from counter
    const frameInfo = document.getElementById('frameCounter').textContent;
    document.getElementById('frame_info').value = frameInfo;
  }
  
  

  // Get wrist data container - if in ergonomic form
  const w = imageElement_width;
  const h = imageElement_height;
  const wristDataContainer = document.getElementById('wristDataContainer');
  
  if (!landmarks || landmarks.length === 0) {
    // Hide landmark info if no data
    if (wristDataContainer) {
      wristDataContainer.innerHTML = '';
    }
    
    // Legacy container for when ergonomic form is not displayed
    const landmarkInfoElement = document.getElementById('landmarkInfo');
    if (landmarkInfoElement) {
      landmarkInfoElement.style.display = 'none';
    }
    return;
  }
  var pessoa1 = landmarks;
  // Get wrist landmarks if available

  // Add event listener to form submission
  document.getElementById('ergonomicForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    // Get values from form
    const adc_atv_musc = document.getElementById('adc_atv_musc').value;
    const adc_for_carg = document.getElementById('adc_for_carg').value;
    const posi_d_pern = document.getElementById('posi_d_pern').value;
    const adc_atv_musc_pern = document.getElementById('adc_atv_musc_pern').value;
    const adc_for_carg_pern = document.getElementById('adc_for_carg_pern').value;
    const frame_info = document.getElementById('frame_info').value;
    
    // Log frame info if it exists
    if (frame_info) {
      console.log(`// ${frame_info}`);
    }

    if (pessoa1.length > 16) {
      const leftWrist = pessoa1[15]; // Index 15 is left wrist
      const rightWrist = pessoa1[16]; // Index 16 is right wrist
      
      //Calcular a posição dos ombros
      const ombro_data = posicaoOmbro(pessoa1, w, h);

      //Verificar se os ombros estão elevados
      const ombro_elevado = verificarOmbrosElevados(pessoa1, w, h);

      //Verificar se os ombros estão abduzidos
      const ombro_abduzido = verificarAbducaoOmbro(pessoa1, w, h);

      //Verificar se os braços estão apoiados
      const braco_apoiado = verificarBracoApoiado(pessoa1, w, h);

      //Calcular a pontuação RULA para o ombro/braço
      const pontuacao_rula_ombro = calcularPontuacaoRulaOmbro(ombro_data, ombro_elevado, ombro_abduzido, braco_apoiado);

      //Calcula o valor do antebraço
      const antebraco_valor = calcularAnguloAntebraco(pessoa1, w, h);

      //Verifica o valor da linha media do antebraço
      const antebraco_linha_media = verificarCruzaLinhaMedia(pessoa1, w, h);

      //Calcular a pontuação RULA para o antebraço
      const pontuacao_rula_antebraco = calcularPontuacaoRulaAntebraco(antebraco_valor, antebraco_linha_media);

      //Calcular pontuação do punho
      const pontuacao_punho = calcularAnguloPunho(pessoa1, w, h);

      //Verifica desvio do punho e rotação
      const desv_rot_punho = verificarDesvioPunho(pessoa1, w, h);

      //Calcular a pontuação RULA para o punho
      const pontuacao_rula_punho = calcularPontuacaoRulaPunho(pontuacao_punho, desv_rot_punho);

      //Avaliação parcial***********************************************************************************************************
      const avaliacao_parcial_result = avaliacaoParcial(adc_atv_musc, adc_for_carg,posi_d_pern,adc_atv_musc_pern,adc_for_carg_pern);

      //Pontuação dos final ombros********************************************************************************************************************************
      const final_wrist_arm_score = classificarPontuacaoRulaMemSup(pontuacao_rula_ombro,pontuacao_rula_antebraco,pontuacao_rula_punho,desv_rot_punho,avaliacao_parcial_result,wristPostureScore);

      //Calcular pontuação do pescoco
      const pontuacao_pescoco = calcularPontuacaoPescoco(pessoa1, w, h);

      //Calcular pontuação do tronco
      const pontuacao_tronco = calcularPontuacaoTronco(pessoa1, w, h);

      //Verifica rotação e lateralização do pescoço
      const rot_lat_pescoco = verificarRotacaoLateralizacaoPescoco(pessoa1, w, h);

      //Verifica rotação e lateralização do tronco
      const rot_lat_tronco = verificarRotacaoLateralizacaoTronco(pessoa1, w, h);

      //Calcula a pontuação total do pescoço, tronco e pernas****************************************************************************************************************************
      const final_trunk_leg_score = classificarPontuacaoRulaMemInfTronco(pontuacao_pescoco,pontuacao_tronco,avaliacao_parcial_result,rot_lat_pescoco,rot_lat_tronco,trunkPostureScoreDictionary);

      //Calcula a pontuação total**********************************************************************************************
      const final_score = classificarTotalPontuacaoRula(final_wrist_arm_score,final_trunk_leg_score,finalScoreDictionary);
      
      
      // Create content for landmark info
      const wristDataHTML = `
        <h3 style="margin-top: 20px;">Ombros</h3>
        <div class="landmark-data">
          <div>
            <h4>Lado Direito</h4>
            <p>Posição(ángulo): ${ombro_data.right_arm.angle.toFixed(2)}º</p>
            <p>Pontuação do ombro: ${pontuacao_rula_ombro.rula_score_right}</p>
            <p>Ombro elevado: ${ombro_elevado.right_shoulder.elevated}</p>
            <p>Ombro abduzido: ${ombro_abduzido.right_shoulder.abducted}</p>
            <p>Braço apoiado: ${braco_apoiado.right_arm.supported}</p>
            <p>Pontuação: ${pontuacao_rula_ombro.rula_score_right}</p>
          </div>
          <div>
            <h4>Lado Esquerdo</h4>
            <p>Posição(ángulo): ${ombro_data.left_arm.angle.toFixed(2)}º</p>
            <p>Pontuação do ombro: ${pontuacao_rula_ombro.rula_score_left}</p>
            <p>Ombro elevado: ${ombro_elevado.left_shoulder.elevated}</p>
            <p>Ombro abduzido: ${ombro_abduzido.left_shoulder.abducted}</p>
            <p>Braço apoiado: ${braco_apoiado.left_arm.supported}</p>
            <p>Pontuação: ${pontuacao_rula_ombro.rula_score_left}</p>
          </div>
        </div>
        <h3 style="margin-top: 20px;">Antebraços</h3>
        <div class="landmark-data">
          <div>
            <h4>Lado Direito</h4>
            <p>Pontuação: ${antebraco_valor.right_forearm.position_value}</p>
            <p>Cruza linha média: ${antebraco_linha_media.right_forearm.cruza_linha_media}</p>
            <p>Pontuação: ${pontuacao_rula_antebraco.right_forearm_value.score}</p>
          </div>
          <div>
            <h4>Lado Esquerdo</h4>
            <p>Pontuação: ${antebraco_valor.right_forearm.position_value}</p>
            <p>Cruza linha média: ${antebraco_linha_media.left_forearm.cruza_linha_media}</p>
            <p>Pontuação: ${pontuacao_rula_antebraco.left_forearm_value.score}</p>
          </div>
        </div>
        <h3 style="margin-top: 20px;">Punho</h3>
        <div class="landmark-data">
          <div>
            <h4>Lado Direito</h4>
            <p>Pontuação: ${pontuacao_punho.right_wrist.wrist_score}</p>
            <p>Desvio de punho: ${desv_rot_punho.right_wrist.desvio_lateral}</p>
            <p>Pontuação: ${pontuacao_rula_punho.right_wrist.score}</p>
            <p>Rotação: ${desv_rot_punho.right_wrist.rotacao}</p>
          </div>
          <div>
            <h4>Lado Esquerdo</h4>
            <p>Pontuação: ${pontuacao_punho.left_wrist.wrist_score}</p>
            <p>Desvio de punho: ${desv_rot_punho.left_wrist.desvio_lateral}</p>
            <p>Pontuação: ${pontuacao_rula_punho.left_wrist.score}</p>
            <p>Rotação: ${desv_rot_punho.left_wrist.rotacao}</p>
          </div>
        </div>
        <h3 style="margin-top: 20px;">PONTUAÇÃO DOS MEMBROS SUPERIORES</h3>
        <div class="landmark-data">
          <div>
            <p>Lado Direito: ${final_wrist_arm_score.right_wrist_arm_score}</p>
            <p>Lado Esquerdo: ${final_wrist_arm_score.left_wrist_arm_score}</p>
          </div>
        </div>
        <h3 style="margin-top: 20px;">Pescoço</h3>
        <div class="landmark-data">
          <div>
            <p>Pontuação: ${pontuacao_pescoco.pescoco}</p>
            <p>Rotação: ${rot_lat_pescoco.rotacao}</p>
            <p>Lateralizado: ${rot_lat_pescoco.lateralizacao}</p>
            <p>Pontuação: ${final_trunk_leg_score.neck_value}</p>
          </div>
        </div>
        <h3 style="margin-top: 20px;">Tronco</h3>
        <div class="landmark-data">
          <div>
            <p>Pontuação: ${pontuacao_tronco.tronco}</p>
            <p>Rotação: ${rot_lat_tronco.rotacao}</p>
            <p>Lateralizado: ${rot_lat_tronco.lateralizacao}</p>
            <p>Pontuação: ${final_trunk_leg_score.trunk_value}</p>
          </div>
        </div>
        <h3 style="margin-top: 20px;">PONTUAÇÃO DO TRONCO E MEMBROS INFERIORES</h3>
        <div class="landmark-data">
          <div>
            <p>->: ${final_trunk_leg_score.trunk_leg_score}</p>
          </div>
        </div>
        <h3 style="margin-top: 20px;">PONTUAÇÃO FINAL</h3>
        <div class="landmark-data">
          <div>
            <p>Lado Direito: ${final_score.final_score_right}</p>
            <p>Lado Esquerdo: ${final_score.final_score_left}</p>
          </div>
        </div>
      `;
      
      // If wristDataContainer exists (inside ergonomic form), display there
      if (wristDataContainer) {
        wristDataContainer.innerHTML = wristDataHTML;
      } else {
        // Otherwise use the legacy container
        const landmarkInfoElement = document.getElementById('landmarkInfo');
        landmarkInfoElement.style.display = 'block';
        landmarkInfoElement.innerHTML = wristDataHTML;
      }
    } else {
      // Hide containers if no wrist data
      if (wristDataContainer) {
        wristDataContainer.innerHTML = '';
      }
      
      const landmarkInfoElement = document.getElementById('landmarkInfo');
      if (landmarkInfoElement) {
        landmarkInfoElement.style.display = 'none';
      }
    }

    
  });

  
}