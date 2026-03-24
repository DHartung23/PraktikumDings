// Calculates Total Daily Energy Expenditure (TDEE) based on Mifflin-St Jeor Equation
export function calculateTDEE(height: number, weight: number, age: number, gender: string): number {
  if (!height || !weight || !age || !gender || gender === '') return 2000; // Default fallback

  // BMR (Basal Metabolic Rate)
  let bmr = (10 * weight) + (6.25 * height) - (5 * age);
  
  if (gender === 'male') {
    bmr += 5;
  } else if (gender === 'female') {
    bmr -= 161;
  } else {
    // Average for 'other'
    bmr -= 78;
  }

  // TDEE multiplier for Sedentary mostly, activity is added dynamically via steps
  const sedentaryMultiplier = 1.2; 
  return Math.round(bmr * sedentaryMultiplier);
}

// Calculate burned calories from steps (rough estimate: 0.04 kcal per step)
export function calculateStepCalories(steps: number): number {
  return Math.round((steps || 0) * 0.04);
}

// Dynamically calculates macronutrient goals based on TDEE and body weight
export function getMacroGoals(weight: number, tdee: number, stepKcal: number = 0) {
  const targetKcal = tdee + stepKcal;
  
  if (!weight || weight <= 0) {
    // Fallback standard diet ratio if weight is unknown (25% P, 50% C, 25% F)
    return {
      kcalGoal: targetKcal || 2000,
      proteinGoal: targetKcal ? Math.round((targetKcal * 0.25) / 4) : 125,
      carbsGoal: targetKcal ? Math.round((targetKcal * 0.50) / 4) : 250,
      fatGoal: targetKcal ? Math.round((targetKcal * 0.25) / 9) : 55,
    }
  }

  // Sensible default for active/average lifestyle: 1.8g protein per kg.
  const proteinGoal = Math.round(weight * 1.8);
  const fatGoal = Math.round(weight * 0.9);
  
  const proteinKcal = proteinGoal * 4;
  const fatKcal = fatGoal * 9;
  
  // Remaining kcal goes to carbs
  let carbsKcal = targetKcal - proteinKcal - fatKcal;
  if (carbsKcal < 0) carbsKcal = 0;
  
  const carbsGoal = Math.round(carbsKcal / 4);
  
  return {
    kcalGoal: targetKcal,
    proteinGoal,
    carbsGoal,
    fatGoal
  }
}
