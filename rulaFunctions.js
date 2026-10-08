export function convertLandmarksToPixels(landmark, imageWidth, imageHeight) {
    // Implementação da função
    const xPx = Math.floor(landmark.x * imageWidth);
    const yPx = Math.floor(landmark.y * imageHeight);
    return [xPx, yPx];
}

export function calculateAnglePixels(point1, point2, point3) {
    /**
     * Calcula o ângulo entre três pontos usando coordenadas em pixels.
     *
     * @param {number[]} point1 - Array [x, y] do primeiro ponto em pixels
     * @param {number[]} point2 - Array [x, y] do ponto central em pixels
     * @param {number[]} point3 - Array [x, y] do terceiro ponto em pixels
     * @returns {number} Ângulo em graus
     */
    // Criar vetores a partir dos pontos
    const vector1 = [point1[0] - point2[0], point1[1] - point2[1]];
    const vector2 = [point3[0] - point2[0], point3[1] - point2[1]];

    // Calcular o produto escalar
    const dotProduct = vector1[0] * vector2[0] + vector1[1] * vector2[1];

    // Calcular as normas dos vetores
    const norm1 = Math.sqrt(vector1[0] ** 2 + vector1[1] ** 2);
    const norm2 = Math.sqrt(vector2[0] ** 2 + vector2[1] ** 2);

    // Calcular o cosseno do ângulo
    let cosAngle = dotProduct / (norm1 * norm2);

    // Limitar o cosAngle entre -1 e 1 para evitar erros numéricos
    cosAngle = Math.max(-1.0, Math.min(1.0, cosAngle));

    // Calcular o ângulo em radianos e depois em graus
    const angleRad = Math.acos(cosAngle);
    const angleDeg = (angleRad * 180) / Math.PI;

    return angleDeg;
}

export function posicaoOmbro(landmark, width, height) {
    /**
     * Calcula a posição dos ombros e retorna os ângulos, pontuações RULA e classificações.
     *
     * @param {Array} landmark - Lista de landmarks do MediaPipe
     * @param {number} width - Largura da imagem/frame
     * @param {number} height - Altura da imagem/frame
     * @returns {Object} Dados dos ombros (ângulos, pontuações RULA e classificações)
     */

    // Posição do ombro, lado direito
    const rightShoulder = convertLandmarksToPixels(landmark[12], width, height);
    const rightElbow = convertLandmarksToPixels(landmark[14], width, height);
    const rightHip = convertLandmarksToPixels(landmark[24], width, height);

    // Posição do ombro, lado esquerdo
    const leftShoulder = convertLandmarksToPixels(landmark[11], width, height);
    const leftElbow = convertLandmarksToPixels(landmark[13], width, height);
    const leftHip = convertLandmarksToPixels(landmark[23], width, height);

    // Função para determinar a pontuação RULA baseada no ângulo do braço
    function getRulaScore(angle) {
        const relativeAngle = Math.abs(angle - 90);

        if (relativeAngle <= 20) { // Posição neutra
            return 1;
        } else if (relativeAngle <= 45) { // Extensão ou leve flexão
            return 2;
        } else if (relativeAngle <= 90) { // Flexão moderada
            return 3;
        } else { // Flexão extrema
            return 4;
        }
    }

    // Calcular ângulos e pontuações RULA
    const rightArmAngle = calculateAnglePixels(rightHip, rightShoulder, rightElbow);
    const rightScore = getRulaScore(rightArmAngle);

    const leftArmAngle = calculateAnglePixels(leftHip, leftShoulder, leftElbow);
    const leftScore = getRulaScore(leftArmAngle);

    // Função para retornar a classificação da posição baseada no score RULA
    function getPositionClassification(score) {
        const classifications = {
            1: "Posicao neutra (-20° a +20°)",
            2: "Leve desvio (extensao >20° ou flexao 20-45°)",
            3: "Desvio moderado (flexao 45-90°)",
            4: "Desvio extremo (flexao >90°)"
        };
        return classifications[score] || "Score inválido";
    }

    return {
        right_arm: {
            angle: rightArmAngle,
            rula_score: rightScore,
            classification: getPositionClassification(rightScore)
        },
        left_arm: {
            angle: leftArmAngle,
            rula_score: leftScore,
            classification: getPositionClassification(leftScore)
        },
        final_score: Math.max(leftScore, rightScore) // Usar o pior caso
    };
}
export function verificarOmbrosElevados(landmark, width, height) {
    /**
     * Verifica se os ombros estão elevados com base na posição vertical dos landmarks.
     *
     * @param {Array} landmark - Lista de landmarks do MediaPipe
     * @param {number} width - Largura da imagem/frame
     * @param {number} height - Altura da imagem/frame
     * @returns {Object} Resultado da verificação para os ombros direito e esquerdo
     */

    // Converter landmarks para pixels
    const rightShoulder = convertLandmarksToPixels(landmark[12], width, height);
    const leftShoulder = convertLandmarksToPixels(landmark[11], width, height);
    const rightHip = convertLandmarksToPixels(landmark[24], width, height);
    const leftHip = convertLandmarksToPixels(landmark[23], width, height);

    // Calcular a diferença vertical entre os ombros e os quadris
    const diffRight = rightShoulder.y - rightHip.y; // Diferença no eixo y
    const diffLeft = leftShoulder.y - leftHip.y;   // Diferença no eixo y

    // Definir um limiar para considerar os ombros elevados
    const threshold = 0.1 * height; // 10% da altura do frame

    // Verificar se os ombros estão elevados
    const rightElevated = diffRight > threshold;
    const leftElevated = diffLeft > threshold;

    // Converter booleanos para valores numéricos (0 ou 1)
    const rightElevatedValue = rightElevated ? 1 : 0;
    const leftElevatedValue = leftElevated ? 1 : 0;

    return {
        right_shoulder: {
            elevated: rightElevatedValue,
            vertical_diff: diffRight,
            threshold: threshold
        },
        left_shoulder: {
            elevated: leftElevatedValue,
            vertical_diff: diffLeft,
            threshold: threshold
        }
    };
}

export function verificarAbducaoOmbro(landmark, width, height) {
    /**
     * Verifica se os ombros estão abduzidos com base no ângulo entre o braço e o tronco.
     *
     * @param {Array} landmark - Lista de landmarks do MediaPipe
     * @param {number} width - Largura da imagem/frame
     * @param {number} height - Altura da imagem/frame
     * @returns {Object} Resultado da verificação para os ombros direito e esquerdo
     */

    // Converter landmarks para pixels
    const rightShoulder = convertLandmarksToPixels(landmark[12], width, height);
    const rightElbow = convertLandmarksToPixels(landmark[14], width, height);
    const rightHip = convertLandmarksToPixels(landmark[24], width, height);

    const leftShoulder = convertLandmarksToPixels(landmark[11], width, height);
    const leftElbow = convertLandmarksToPixels(landmark[13], width, height);
    const leftHip = convertLandmarksToPixels(landmark[23], width, height);

    // Calcular o ângulo de abdução para o ombro direito
    const angleRight = calculateAnglePixels(rightHip, rightShoulder, rightElbow);

    // Calcular o ângulo de abdução para o ombro esquerdo
    const angleLeft = calculateAnglePixels(leftHip, leftShoulder, leftElbow);

    // Definir um limiar para considerar o ombro abduzido
    const abductionThreshold = 45; // Limiar de 45 graus

    // Verificar se os ombros estão abduzidos
    const rightAbducted = angleRight > abductionThreshold;
    const leftAbducted = angleLeft > abductionThreshold;

    // Converter booleanos para valores numéricos (0 ou 1)
    const rightAbductedValue = rightAbducted ? 1 : 0;
    const leftAbductedValue = leftAbducted ? 1 : 0;

    return {
        right_shoulder: {
            abducted: rightAbductedValue,
            angle: angleRight,
            threshold: abductionThreshold
        },
        left_shoulder: {
            abducted: leftAbductedValue,
            angle: angleLeft,
            threshold: abductionThreshold
        }
    };
}

export function verificarBracoApoiado(landmark, width, height) {
    /**
     * Verifica se os braços estão apoiados com base na distância entre o cotovelo/punho e uma referência.
     *
     * @param {Array} landmark - Lista de landmarks do MediaPipe
     * @param {number} width - Largura da imagem/frame
     * @param {number} height - Altura da imagem/frame
     * @returns {Object} Resultado da verificação para os braços direito e esquerdo
     */

    // Converter landmarks para pixels
    const rightElbow = convertLandmarksToPixels(landmark[14], width, height);
    const rightWrist = convertLandmarksToPixels(landmark[16], width, height);
    const rightHip = convertLandmarksToPixels(landmark[24], width, height);

    const leftElbow = convertLandmarksToPixels(landmark[13], width, height);
    const leftWrist = convertLandmarksToPixels(landmark[15], width, height);
    const leftHip = convertLandmarksToPixels(landmark[23], width, height);

    // Definir uma superfície de referência (simulando uma mesa)
    const referenceSurface = rightHip.y; // Usar a altura do quadril como referência

    // Definir um limiar para considerar o braço apoiado
    const supportThreshold = 0.1 * height; // 10% da altura do frame

    // Verificar se o braço direito está apoiado
    const rightElbowDistance = Math.abs(rightElbow.y - referenceSurface);
    const rightWristDistance = Math.abs(rightWrist.y - referenceSurface);
    const rightArmSupported = (rightElbowDistance < supportThreshold) || (rightWristDistance < supportThreshold);

    // Verificar se o braço esquerdo está apoiado
    const leftElbowDistance = Math.abs(leftElbow.y - referenceSurface);
    const leftWristDistance = Math.abs(leftWrist.y - referenceSurface);
    const leftArmSupported = (leftElbowDistance < supportThreshold) || (leftWristDistance < supportThreshold);

    // Converter booleanos para valores numéricos (-1 ou 0)
    const rightArmSupportedValue = rightArmSupported ? -1 : 0;
    const leftArmSupportedValue = leftArmSupported ? -1 : 0;

    return {
        right_arm: {
            supported: rightArmSupportedValue,
            elbow_distance: rightElbowDistance,
            wrist_distance: rightWristDistance,
            threshold: supportThreshold
        },
        left_arm: {
            supported: leftArmSupportedValue,
            elbow_distance: leftElbowDistance,
            wrist_distance: leftWristDistance,
            threshold: supportThreshold
        }
    };
}

/**
 * Calcula a pontuação RULA para o ombro/braço com base nos dados coletados.
 *
 * @param {Object} ombroData - Dados do ombro (ângulo, pontuação RULA, classificação).
 * @param {Object} ombroElevado - Resultado da verificação de ombros elevados.
 * @param {Object} ombroAbduzido - Resultado da verificação de ombros abduzidos.
 * @param {Object} bracoApoiado - Resultado da verificação de braços apoiados.
 * @returns {Object} Pontuação RULA para o ombro/braço.
 */
export function calcularPontuacaoRulaOmbro(ombroData, ombroElevado, ombroAbduzido, bracoApoiado) {
    // Lado direito
    const ombroDataRight = ombroData.right_arm.rula_score;
    const ombroElevadoRight = ombroElevado.right_shoulder.elevated;
    const ombroAbduzidoRight = ombroAbduzido.right_shoulder.abducted;
    const bracoApoiadoRight = bracoApoiado.right_arm.supported;

    // Lado esquerdo
    const ombroDataLeft = ombroData.left_arm.rula_score;
    const ombroElevadoLeft = ombroElevado.left_shoulder.elevated;
    const ombroAbduzidoLeft = ombroAbduzido.left_shoulder.abducted;
    const bracoApoiadoLeft = bracoApoiado.left_arm.supported;

    // Soma do lado direito
    let rulaScoreRight = ombroDataRight + ombroElevadoRight + ombroAbduzidoRight + bracoApoiadoRight;
    // Garantir que a pontuação não seja menor que 1
    rulaScoreRight = Math.max(rulaScoreRight, 1);

    // Soma do lado esquerdo
    let rulaScoreLeft = ombroDataLeft + ombroElevadoLeft + ombroAbduzidoLeft + bracoApoiadoLeft;
    // Garantir que a pontuação não seja menor que 1
    rulaScoreLeft = Math.max(rulaScoreLeft, 1);

    return {
        rula_score_right: rulaScoreRight,
        rula_score_left: rulaScoreLeft
    };
}

/**
 * Calcula o ângulo do antebraço com base nos landmarks do ombro, cotovelo e punho.
 *
 * @param {Array} landmark - Lista de landmarks do MediaPipe
 * @param {number} width - Largura da imagem/frame
 * @param {number} height - Altura da imagem/frame
 * @returns {Object} Ângulos do antebraço direito e esquerdo.
 */
export function calcularAnguloAntebraco(landmark, width, height) {
    // Converter landmarks para pixels
    const rightShoulder = convertLandmarksToPixels(landmark[12], width, height);
    const rightElbow = convertLandmarksToPixels(landmark[14], width, height);
    const rightWrist = convertLandmarksToPixels(landmark[16], width, height);

    const leftShoulder = convertLandmarksToPixels(landmark[11], width, height);
    const leftElbow = convertLandmarksToPixels(landmark[13], width, height);
    const leftWrist = convertLandmarksToPixels(landmark[15], width, height);

    // Calcular o ângulo do antebraço direito
    const angleRight = calculateAnglePixels(rightShoulder, rightElbow, rightWrist);

    // Calcular o ângulo do antebraço esquerdo
    const angleLeft = calculateAnglePixels(leftShoulder, leftElbow, leftWrist);

    /**
     * Classifica a posição do antebraço com base no ângulo calculado.
     *
     * @param {number} angle - Ângulo do antebraço.
     * @returns {number} Pontuação RULA para o antebraço.
     */
    function classificarPosicaoAntebraco(angle) {
        if (angle >= 0 && angle <= 60) {
            return 1; // Posição neutra
        } else if (angle > 60 && angle <= 100) {
            return 2; // Leve desvio
        } else if (angle > 100 && angle <= 140) {
            return 2; // Desvio moderado
        } else {
            return 1; // Desvio extremo
        }
    }

    return {
        right_forearm: {
            position_value: classificarPosicaoAntebraco(angleRight)
        },
        left_forearm: {
            position_value: classificarPosicaoAntebraco(angleLeft)
        }
    };
}

/**
 * Verifica se o antebraço cruza a linha média do corpo.
 *
 * @param {Array} landmark - Lista de landmarks do MediaPipe
 * @param {number} width - Largura da imagem/frame
 * @param {number} height - Altura da imagem/frame
 * @returns {Object} Resultado da verificação para os antebraços direito e esquerdo.
 */
export function verificarCruzaLinhaMedia(landmark, width, height) {
    // Converter landmarks para pixels
    const rightShoulder = convertLandmarksToPixels(landmark[12], width, height);
    const rightWrist = convertLandmarksToPixels(landmark[16], width, height);

    const leftShoulder = convertLandmarksToPixels(landmark[11], width, height);
    const leftWrist = convertLandmarksToPixels(landmark[15], width, height);

    // Verificar se o punho cruza a linha média (eixo x do ombro)
    const rightCrosses = rightWrist.x < rightShoulder.x; // Punho à esquerda do ombro
    const leftCrosses = leftWrist.x > leftShoulder.x;   // Punho à direita do ombro

    // Converter booleanos para valores numéricos (0 ou 1)
    const rightCrossesValue = rightCrosses ? 1 : 0;
    const leftCrossesValue = leftCrosses ? 1 : 0;

    return {
        right_forearm: {
            cruza_linha_media: rightCrossesValue
        },
        left_forearm: {
            cruza_linha_media: leftCrossesValue
        }
    };
}

/**
 * Calcula a pontuação RULA para o antebraço com base nos valores de posição e cruzamento da linha média.
 *
 * @param {Object} antebracoValor - Valores de posição do antebraço.
 * @param {Object} antebracoLinhaMedia - Resultado da verificação de cruzamento da linha média.
 * @returns {Object} Pontuação RULA para os antebraços direito e esquerdo.
 */
export function calcularPontuacaoRulaAntebraco(antebracoValor, antebracoLinhaMedia) {
    // Lado direito
    const rightUpperArm = antebracoValor.right_forearm.position_value;
    const rightMidLine = antebracoLinhaMedia.right_forearm.cruza_linha_media;

    // Lado esquerdo
    const leftUpperArm = antebracoValor.left_forearm.position_value;
    const leftMidLine = antebracoLinhaMedia.left_forearm.cruza_linha_media;

    // Calcular a pontuação RULA
    const resultRight = rightUpperArm + rightMidLine;
    const resultLeft = leftUpperArm + leftMidLine;

    return {
        right_forearm_value: {
            score: resultRight
        },
        left_forearm_value: {
            score: resultLeft
        }
    };
}

/**
 * Calcula o ângulo do punho com base nos landmarks do cotovelo, punho e dedos.
 *
 * @param {Array} landmark - Lista de landmarks do MediaPipe
 * @param {number} width - Largura da imagem/frame
 * @param {number} height - Altura da imagem/frame
 * @returns {Object} Ângulos do punho direito e esquerdo.
 */
export function calcularAnguloPunho(landmark, width, height) {
    // Converter landmarks para pixels
    const rightElbow = convertLandmarksToPixels(landmark[14], width, height);
    const rightWrist = convertLandmarksToPixels(landmark[16], width, height);
    const rightFingers = convertLandmarksToPixels(landmark[18], width, height);

    const leftElbow = convertLandmarksToPixels(landmark[13], width, height);
    const leftWrist = convertLandmarksToPixels(landmark[15], width, height);
    const leftFingers = convertLandmarksToPixels(landmark[17], width, height);

    // Calcular o ângulo do punho direito
    const angleRight = calculateAnglePixels(rightElbow, rightWrist, rightFingers);

    // Calcular o ângulo do punho esquerdo
    const angleLeft = calculateAnglePixels(leftElbow, leftWrist, leftFingers);

    /**
     * Classifica a posição do punho com base no ângulo calculado.
     *
     * @param {number} angle - Ângulo do punho.
     * @returns {number} Pontuação RULA para o punho.
     */
    function classificarPosicaoPunho(angle) {
        if (angle >= 0 && angle < 15) {
            return 1; // Posição neutra
        } else if (angle === 15) {
            return 2; // Leve desvio
        } else if (angle > 15) {
            return 3; // Desvio moderado
        } else {
            return 1; // Desvio extremo
        }
    }

    return {
        right_wrist: {
            angle: angleRight,
            wrist_score: classificarPosicaoPunho(angleRight)
        },
        left_wrist: {
            angle: angleLeft,
            wrist_score: classificarPosicaoPunho(angleLeft)
        }
    };
}

/**
 * Verifica se o punho está desviado lateralmente ou em rotação.
 *
 * @param {Array} landmark - Lista de landmarks do MediaPipe
 * @param {number} width - Largura da imagem/frame
 * @param {number} height - Altura da imagem/frame
 * @returns {Object} Resultado da verificação para os punhos direito e esquerdo.
 */
export function verificarDesvioPunho(landmark, width, height) {
    // Converter landmarks para pixels
    const rightWrist = convertLandmarksToPixels(landmark[16], width, height);
    const rightFingers = convertLandmarksToPixels(landmark[18], width, height);

    const leftWrist = convertLandmarksToPixels(landmark[15], width, height);
    const leftFingers = convertLandmarksToPixels(landmark[17], width, height);

    // Verificar desvio lateral (comparar coordenadas x do punho e dedos)
    const rightLateralDeviation = Math.abs(rightWrist.x - rightFingers.x) > 0.1 * width;
    const leftLateralDeviation = Math.abs(leftWrist.x - leftFingers.x) > 0.1 * width;

    // Verificar rotação (comparar coordenadas y do punho e dedos)
    const rightRotation = Math.abs(rightWrist.y - rightFingers.y) > 0.1 * height;
    const leftRotation = Math.abs(leftWrist.y - leftFingers.y) > 0.1 * height;

    // Converter booleanos para valores numéricos
    const rightLateralDeviationValue = rightLateralDeviation ? 1 : 0;
    const leftLateralDeviationValue = leftLateralDeviation ? 1 : 0;

    const rightRotationValue = rightRotation ? 2 : 1;
    const leftRotationValue = leftRotation ? 2 : 1;

    return {
        right_wrist: {
            desvio_lateral: rightLateralDeviationValue,
            rotacao: rightRotationValue
        },
        left_wrist: {
            desvio_lateral: leftLateralDeviationValue,
            rotacao: leftRotationValue
        }
    };
}

/**
 * Calcula a pontuação RULA para o punho com base na pontuação inicial e no desvio/rotação.
 *
 * @param {Object} pontuacaoPunho - Pontuação inicial do punho.
 * @param {Object} desvRotPunho - Resultado da verificação de desvio e rotação do punho.
 * @returns {Object} Pontuação RULA para os punhos direito e esquerdo.
 */
export function calcularPontuacaoRulaPunho(pontuacaoPunho, desvRotPunho) {
    // Lado direito
    const rightPontuacaoPunho = pontuacaoPunho.right_wrist.wrist_score;
    const rightDesvRotPunho = desvRotPunho.right_wrist.desvio_lateral;
    const rightWristScore = rightPontuacaoPunho + rightDesvRotPunho;

    // Lado esquerdo
    const leftPontuacaoPunho = pontuacaoPunho.left_wrist.wrist_score;
    const leftDesvRotPunho = desvRotPunho.left_wrist.desvio_lateral;
    const leftWristScore = leftPontuacaoPunho + leftDesvRotPunho;

    return {
        right_wrist: {
            score: rightWristScore
        },
        left_wrist: {
            score: leftWristScore
        }
    };
}

/**
 * Realiza a avaliação parcial com base nos critérios fornecidos.
 *
 * @param {string} adcAtvMusc - Atividade muscular adicional.
 * @param {string} adcForCarg - Força ou carga adicional.
 * @param {string} posiDPern - Posição das pernas.
 * @param {string} adcAtvMuscPern - Atividade muscular adicional nas pernas.
 * @param {string} adcForCargPern - Força ou carga adicional nas pernas.
 * @returns {Object} Resultado da avaliação parcial.
 */
export function avaliacaoParcial(adcAtvMusc, adcForCarg, posiDPern, adcAtvMuscPern, adcForCargPern) {
    const dicAdcAtvMusc = {
        'Nenhum': 0,
        'Postura estática (+ que 1 minuto)': 1,
        'Ação repetida (4 ou mais vezes por minuto)': 1
    };

    const dicForCarg = {
        'Ausente ou menor que 2kg (Intermitente)': 0,
        'Entre 2 e 10Kg (Intermitente)': 1,
        'Entre 2 e 10Kg (Estático ou Mais que 4 vezes por minuto)': 2,
        'Maior que 10Kg': 3
    };

    const dicPosiDPern = {
        'Pernas e pés apoiados e equilibrados': 1,
        'Pernas e pés não estão apoiados e/ou equilibrados': 2
    };

    const dicAdcAtvMuscPern = {
        'Nenhum': 0,
        'Postura estática (+ que 1 minuto)': 1,
        'Ação repetida (4 ou mais vezes por minuto)': 1
    };

    const dicForCargPern = {
        'Ausente ou menor que 2kg (Intermitente)': 0,
        'Entre 2 e 10Kg (Intermitente)': 1,
        'Entre 2 e 10Kg (Estático ou Mais que 4 vezes por minuto)': 2,
        'Maior que 10Kg': 3
    };

    return {
        adc_atv_musc: dicAdcAtvMusc[adcAtvMusc],
        adc_for_carg: dicForCarg[adcForCarg],
        posi_d_pern: dicPosiDPern[posiDPern],
        adc_atv_musc_pern: dicAdcAtvMuscPern[adcAtvMuscPern],
        adc_for_carg_pern: dicForCargPern[adcForCargPern]
    };
}

/**
 * Calcula a pontuação RULA para o pescoço com base nos landmarks.
 *
 * @param {Array} landmark - Lista de landmarks do MediaPipe
 * @param {number} width - Largura da imagem/frame
 * @param {number} height - Altura da imagem/frame
 * @returns {Object} Pontuação RULA para o pescoço.
 */
export function calcularPontuacaoPescoco(landmark, width, height) {
    // Converter landmarks para pixels
    const shoulder = convertLandmarksToPixels(landmark[11], width, height); // Ombro esquerdo
    const neck = convertLandmarksToPixels(landmark[0], width, height);      // Base do pescoço
    const eyeBase = convertLandmarksToPixels(landmark[1], width, height);  // Base do pescoço

    // Calcular o ângulo do pescoço (entre ombro, pescoço e base do pescoço)
    const anglePescoco = calculateAnglePixels(shoulder, neck, eyeBase);

    // Classificar a posição do pescoço
    let pontuacaoPescoco;
    if (anglePescoco >= 0 && anglePescoco <= 10) {
        pontuacaoPescoco = 1; // Posição neutra
    } else if (anglePescoco > 10 && anglePescoco <= 20) {
        pontuacaoPescoco = 2; // Leve desvio
    } else if (anglePescoco > 20 && anglePescoco <= 30) {
        pontuacaoPescoco = 3; // Desvio moderado
    } else {
        pontuacaoPescoco = 4; // Desvio extremo
    }

    return {
        pescoco: pontuacaoPescoco
    };
}

/**
 * Calcula o ângulo de inclinação do tronco com base nos landmarks do ombro e quadril.
 *
 * @param {Array} landmark - Lista de landmarks do MediaPipe
 * @param {number} width - Largura da imagem/frame
 * @param {number} height - Altura da imagem/frame
 * @returns {Object} Pontuação RULA para o tronco.
 */
export function calcularPontuacaoTronco(landmark, width, height) {
    // Converter landmarks para pixels
    const shoulderLeft = convertLandmarksToPixels(landmark[11], width, height); // Ombro esquerdo
    const shoulderRight = convertLandmarksToPixels(landmark[12], width, height); // Ombro direito
    const hipLeft = convertLandmarksToPixels(landmark[23], width, height); // Quadril esquerdo
    const hipRight = convertLandmarksToPixels(landmark[24], width, height); // Quadril direito

    // Calcular o ponto médio dos ombros e quadris
    const shoulderMid = {
        x: (shoulderLeft.x + shoulderRight.x) / 2,
        y: (shoulderLeft.y + shoulderRight.y) / 2
    };
    const hipMid = {
        x: (hipLeft.x + hipRight.x) / 2,
        y: (hipLeft.y + hipRight.y) / 2
    };

    // Calcular o ângulo de inclinação do tronco em relação à vertical
    const angleTronco = calculateAnglePixels(
        { x: shoulderMid.x, y: shoulderMid.y - 100 }, // Ponto acima do ombro (vertical)
        shoulderMid, // Ponto médio dos ombros
        hipMid // Ponto médio dos quadris
    );

    // Classificar a posição do tronco
    let pontuacaoTronco;
    if (angleTronco === 0) {
        pontuacaoTronco = 1; // Posição neutra
    } else if (angleTronco > 0 && angleTronco <= 20) {
        pontuacaoTronco = 2; // Leve desvio
    } else if (angleTronco > 20 && angleTronco <= 60) {
        pontuacaoTronco = 3; // Desvio moderado
    } else if (angleTronco > 60) {
        pontuacaoTronco = 4; // Desvio extremo
    } else {
        pontuacaoTronco = 1; // Caso padrão
    }

    return {
        tronco: pontuacaoTronco
    };
}

/**
 * Verifica se o pescoço está em rotação ou lateralização com base nos landmarks.
 *
 * @param {Array} landmark - Lista de landmarks do MediaPipe
 * @param {number} width - Largura da imagem/frame
 * @param {number} height - Altura da imagem/frame
 * @returns {Object} Resultado da verificação para rotação e lateralização do pescoço.
 */
export function verificarRotacaoLateralizacaoPescoco(landmark, width, height) {
    // Converter landmarks para pixels
    const basePescoco = convertLandmarksToPixels(landmark[0], width, height); // Base do pescoço
    const nariz = convertLandmarksToPixels(landmark[1], width, height);       // Nariz

    // Calcular a diferença horizontal (rotação) e vertical (lateralização)
    const diffRotacao = nariz.x - basePescoco.x; // Diferença no eixo x
    const diffLateralizacao = nariz.y - basePescoco.y; // Diferença no eixo y

    // Definir limiares para rotação e lateralização
    const rotacaoThreshold = 0.1 * width; // 10% da largura do frame
    const lateralizacaoThreshold = 0.1 * height; // 10% da altura do frame

    // Verificar rotação
    let rotacao = "Nenhuma";
    if (Math.abs(diffRotacao) > rotacaoThreshold) {
        rotacao = diffRotacao < 0 ? "Esquerda" : "Direita";
    }

    // Verificar lateralização
    let lateralizacao = "Nenhuma";
    if (Math.abs(diffLateralizacao) > lateralizacaoThreshold) {
        lateralizacao = diffLateralizacao < 0 ? "Cima" : "Baixo";
    }

    /**
     * Atribui pontuação adicional com base na rotação e lateralização do pescoço.
     *
     * @param {string} rotacao - Classificação da rotação ("Nenhuma", "Esquerda", "Direita").
     * @param {string} lateralizacao - Classificação da lateralização ("Nenhuma", "Cima", "Baixo").
     * @returns {Object} Pontuação adicional.
     */
    function atribuirPontuacaoPescoco(rotacao, lateralizacao) {
        let pontuacaoRotacao = 0;
        let pontuacaoLateralizacao = 0;

        if (rotacao !== "Nenhuma") {
            pontuacaoRotacao = 1; // Adiciona 1 ponto se houver rotação
        }
        if (lateralizacao !== "Nenhuma") {
            pontuacaoLateralizacao = 1; // Adiciona 1 ponto se houver lateralização
        }

        return {
            pontuacaoRotacao: pontuacaoRotacao,
            pontuacaoLateralizacao: pontuacaoLateralizacao
        };
    }

    const rotationScore = atribuirPontuacaoPescoco(rotacao, lateralizacao).pontuacaoRotacao;
    const lateralizationScore = atribuirPontuacaoPescoco(rotacao, lateralizacao).pontuacaoLateralizacao;

    return {
        rotacao: rotationScore,
        lateralizacao: lateralizationScore,
        diff_rotacao: diffRotacao,
        diff_lateralizacao: diffLateralizacao,
        final_score: atribuirPontuacaoPescoco(rotacao, lateralizacao)
    };
}

/**
 * Verifica se o tronco está em rotação ou lateralizado com base nos landmarks.
 *
 * @param {Array} landmark - Lista de landmarks do MediaPipe
 * @param {number} width - Largura da imagem/frame
 * @param {number} height - Altura da imagem/frame
 * @returns {Object} Resultado da verificação para rotação e lateralização do tronco.
 */
export function verificarRotacaoLateralizacaoTronco(landmark, width, height) {
    // Converter landmarks para pixels
    const shoulderLeft = convertLandmarksToPixels(landmark[11], width, height); // Ombro esquerdo
    const shoulderRight = convertLandmarksToPixels(landmark[12], width, height); // Ombro direito
    const hipLeft = convertLandmarksToPixels(landmark[23], width, height); // Quadril esquerdo
    const hipRight = convertLandmarksToPixels(landmark[24], width, height); // Quadril direito

    // Calcular o ponto médio dos ombros e quadris
    const shoulderMid = {
        x: (shoulderLeft.x + shoulderRight.x) / 2,
        y: (shoulderLeft.y + shoulderRight.y) / 2
    };
    const hipMid = {
        x: (hipLeft.x + hipRight.x) / 2,
        y: (hipLeft.y + hipRight.y) / 2
    };

    // Calcular a diferença horizontal (rotação) e vertical (lateralização)
    const diffRotacao = shoulderMid.x - hipMid.x; // Diferença no eixo x
    const diffLateralizacao = shoulderMid.y - hipMid.y; // Diferença no eixo y

    // Definir limiares para rotação e lateralização
    const rotacaoThreshold = 0.1 * width; // 10% da largura do frame
    const lateralizacaoThreshold = 0.1 * height; // 10% da altura do frame

    // Verificar rotação
    let rotacao = "Nenhuma";
    if (Math.abs(diffRotacao) > rotacaoThreshold) {
        rotacao = diffRotacao < 0 ? "Esquerda" : "Direita";
    }

    // Verificar lateralização
    let lateralizacao = "Nenhuma";
    if (Math.abs(diffLateralizacao) > lateralizacaoThreshold) {
        lateralizacao = diffLateralizacao < 0 ? "Cima" : "Baixo";
    }

    /**
     * Atribui pontuação adicional com base na rotação e lateralização do tronco.
     *
     * @param {string} rotacao - Classificação da rotação ("Nenhuma", "Esquerda", "Direita").
     * @param {string} lateralizacao - Classificação da lateralização ("Nenhuma", "Cima", "Baixo").
     * @returns {Object} Pontuação adicional.
     */
    function atribuirPontuacaoTronco(rotacao, lateralizacao) {
        let pontuacaoRotacao = 0;
        let pontuacaoLateralizacao = 0;

        if (rotacao !== "Nenhuma") {
            pontuacaoRotacao = 1; // Adiciona 1 ponto se houver rotação
        }
        if (lateralizacao !== "Nenhuma") {
            pontuacaoLateralizacao = 1; // Adiciona 1 ponto se houver lateralização
        }

        return {
            pontuacaoRotacao: pontuacaoRotacao,
            pontuacaoLateralizacao: pontuacaoLateralizacao
        };
    }

    const rotacaoScore = atribuirPontuacaoTronco(rotacao, lateralizacao).pontuacaoRotacao;
    const lateralizacaoScore = atribuirPontuacaoTronco(rotacao, lateralizacao).pontuacaoLateralizacao;

    return {
        rotacao: rotacaoScore,
        lateralizacao: lateralizacaoScore,
        diff_rotacao: diffRotacao,
        diff_lateralizacao: diffLateralizacao,
        final_score: atribuirPontuacaoTronco(rotacao, lateralizacao)
    };
}

/**
 * Classifica a pontuação RULA de acordo com o nível de risco para os membros superiores.
 *
 * @param {Object} pontuacaoRulaOmbro - Pontuação RULA do ombro.
 * @param {Object} pontuacaoRulaAntebraco - Pontuação RULA do antebraço.
 * @param {Object} pontuacaoRulaPunho - Pontuação RULA do punho.
 * @param {Object} desvRotPunho - Desvio e rotação do punho.
 * @param {Object} avaliacaoParcialResult - Resultado da avaliação parcial (atividade e carga).
 * @param {Object} wristPostureScore - Tabela de pontuação de postura do punho.
 * @returns {Object} Pontuação RULA para os membros superiores direito e esquerdo.
 */
export function classificarPontuacaoRulaMemSup(
    pontuacaoRulaOmbro,
    pontuacaoRulaAntebraco,
    pontuacaoRulaPunho,
    desvRotPunho,
    avaliacaoParcialResult,
    wristPostureScore
) {
    // OMBRO (BRAÇO) - Lado Direito
    const pontuacaoRulaOmbroD = pontuacaoRulaOmbro.rula_score_right;
    const pontuacaoRulaAntebracoD = pontuacaoRulaAntebraco.right_forearm_value.score;
    const pontuacaoRulaPunhoD = pontuacaoRulaPunho.right_wrist.score;
    const desvRotPunhoD = desvRotPunho.right_wrist.rotacao;

    // Wrist Posture Score - Right Side
    const WPSD = wristPostureScore[pontuacaoRulaOmbroD][pontuacaoRulaAntebracoD][pontuacaoRulaPunhoD][desvRotPunhoD];

    // OMBRO (BRAÇO) - Lado Esquerdo
    const pontuacaoRulaOmbroE = pontuacaoRulaOmbro.rula_score_left;
    const pontuacaoRulaAntebracoE = pontuacaoRulaAntebraco.left_forearm_value.score;
    const pontuacaoRulaPunhoE = pontuacaoRulaPunho.left_wrist.score;
    const desvRotPunhoE = desvRotPunho.left_wrist.rotacao;

    // Wrist Posture Score - Left Side
    const WPSE = wristPostureScore[pontuacaoRulaOmbroE][pontuacaoRulaAntebracoE][pontuacaoRulaPunhoE][desvRotPunhoE];

    // Adicionais atividade, carga e força
    const avaliacaoAdcAtvMusc = avaliacaoParcialResult.adc_atv_musc;
    const avaliacaoAdcForCarg = avaliacaoParcialResult.adc_for_carg;

    // Calcular a pontuação final para os membros superiores
    const rightWristArmScore = WPSD + avaliacaoAdcAtvMusc + avaliacaoAdcForCarg;
    const leftWristArmScore = WPSE + avaliacaoAdcAtvMusc + avaliacaoAdcForCarg;

    return {
        right_wrist_arm_score: rightWristArmScore,
        left_wrist_arm_score: leftWristArmScore
    };
}

/**
 * Classifica a pontuação RULA de acordo com o nível de risco para os membros inferiores e tronco.
 *
 * @param {Object} pontuacaoPescoco - Pontuação RULA do pescoço.
 * @param {Object} pontuacaoTronco - Pontuação RULA do tronco.
 * @param {Object} avaliacaoParcialResult - Resultado da avaliação parcial (atividade e carga).
 * @param {Object} rotLatPescoco - Rotação e lateralização do pescoço.
 * @param {Object} rotLatTronco - Rotação e lateralização do tronco.
 * @param {Object} trunkPostureScoreDictionary - Tabela de pontuação de postura do tronco.
 * @returns {Object} Pontuação RULA para o pescoço, tronco e membros inferiores.
 */
export function classificarPontuacaoRulaMemInfTronco(
    pontuacaoPescoco,
    pontuacaoTronco,
    avaliacaoParcialResult,
    rotLatPescoco,
    rotLatTronco,
    trunkPostureScoreDictionary
) {
    // POSICIONAMENTO DO PESCOÇO
    const pontuacaoPescocoValue = pontuacaoPescoco.pescoco;
    const pontuacaoTroncoValue = pontuacaoTronco.tronco;
    const rotPescocoValue = rotLatPescoco.rotacao;
    const latPescocoValue = rotLatPescoco.lateralizacao;
    const posiDPern = avaliacaoParcialResult.posi_d_pern;

    // Adicionais atividade, carga e força
    const adcAtvMuscPern = avaliacaoParcialResult.adc_atv_musc_pern;
    const adcForCargPern = avaliacaoParcialResult.adc_for_carg_pern;

    const rotLatTroncoValue = rotLatTronco.rotacao;
    const latTroncoValue = rotLatTronco.lateralizacao;

    // PONTUAÇÃO PESCOÇO
    const neckValue = pontuacaoPescocoValue + rotPescocoValue + latPescocoValue;

    // PONTUAÇÃO TRONCO
    const trunkValue = pontuacaoTroncoValue + rotLatTroncoValue + latTroncoValue;

    // Obter a pontuação de postura do tronco
    const trunkPostureScore = trunkPostureScoreDictionary[neckValue][trunkValue][posiDPern];

    // Calcular a pontuação final para o tronco e membros inferiores
    const trunkLegScore = trunkPostureScore + adcAtvMuscPern + adcForCargPern;

    return {
        neck_value: neckValue,
        trunk_value: trunkValue,
        trunk_posture_score: trunkPostureScore,
        trunk_leg_score: trunkLegScore
    };
}

/**
 * Classifica a pontuação RULA final com base nas pontuações dos membros superiores, inferiores e tronco.
 *
 * @param {Object} finalWristArmScore - Pontuação final dos membros superiores.
 * @param {Object} finalTrunkLegScore - Pontuação final do tronco e membros inferiores.
 * @param {Object} finalScoreDictionary - Tabela de pontuação RULA final.
 * @returns {Object} Pontuação RULA final para os lados direito e esquerdo.
 */
export function classificarTotalPontuacaoRula(finalWristArmScore, finalTrunkLegScore, finalScoreDictionary) {
    let finalWristArmScoreRight = finalWristArmScore.right_wrist_arm_score;
    let finalWristArmScoreLeft = finalWristArmScore.left_wrist_arm_score;
    let finalTrunkLegScoreValue = finalTrunkLegScore.trunk_leg_score;

    // Limitar as pontuações máximas
    if (finalWristArmScoreRight > 8) {
        finalWristArmScoreRight = 8;
    }
    if (finalWristArmScoreLeft > 8) {
        finalWristArmScoreLeft = 8;
    }
    if (finalTrunkLegScoreValue > 7) {
        finalTrunkLegScoreValue = 7;
    }

    // Obter a pontuação final usando a tabela de pontuação RULA
    const finalScoreRight = finalScoreDictionary[finalWristArmScoreRight][finalTrunkLegScoreValue];
    const finalScoreLeft = finalScoreDictionary[finalWristArmScoreLeft][finalTrunkLegScoreValue];

    return {
        final_score_right: finalScoreRight,
        final_score_left: finalScoreLeft
    };
}