function evaluateAnswer(question, answer) {
    if (!answer || answer.trim().length < 20) return 0;
    
    const wordCount = answer.trim().split(/\s+/).length;
    let score = 0;
    
    if (wordCount >= 50) score += 40;
    else if (wordCount >= 30) score += 30;
    else if (wordCount >= 15) score += 20;
    else score += 10;
  
    const hasExamples = /example|instance|such as|like|for instance|e\.g/i.test(answer);
    if (hasExamples) score += 20;
  
    const hasStructure = answer.includes(",") || answer.includes(".") || answer.length > 100;
    if (hasStructure) score += 20;
  
    const technicalWords = /because|therefore|however|difference|between|means|used|works|allows|prevents|enables|creates|returns|defines/i;
    if (technicalWords.test(answer)) score += 20;
  
    return Math.min(score, 100);
  }
  
  export default async function handler(req, res) {
    if (req.method !== "POST")
      return res.status(405).json({ error: "Method not allowed" });
  
    const { skill, questions, answers } = req.body;
  
    let totalScore = 0;
    const questionScores = questions.map((q, i) => {
      return evaluateAnswer(q, answers[i]);
    });
  
    totalScore = Math.round(
      questionScores.reduce((a, b) => a + b, 0) / questions.length
    );
  
    let badge = "Unverified";
    if (totalScore >= 90) badge = "Master";
    else if (totalScore >= 80) badge = "Expert";
    else if (totalScore >= 70) badge = "Skilled";
    else if (totalScore >= 60) badge = "Verified";
  
    let feedback = "";
    if (totalScore >= 80) {
      feedback = `Excellent performance in ${skill}! Your answers showed strong knowledge and clear communication. You demonstrated good understanding of key concepts with solid explanations.`;
    } else if (totalScore >= 60) {
      feedback = `Good performance in ${skill}. You showed a reasonable understanding of core concepts. To improve further, try to give more detailed answers with specific examples.`;
    } else {
      feedback = `You showed basic knowledge of ${skill}. To improve your score, provide more detailed answers with concrete examples and explain the reasoning behind your points.`;
    }
  
    return res.status(200).json({ score: totalScore, badge, feedback });
  }