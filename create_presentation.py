from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.enum.text import PP_ALIGN

# Create a presentation object
prs = Presentation()

# Slide 1: Title Slide
slide_layout = prs.slide_layouts[0]
slide = prs.slides.add_slide(slide_layout)
title = slide.shapes.title
subtitle = slide.placeholders[1]
title.text = "WeatherPulse: Advanced Weather Analytics and Forecasting"
subtitle.text = "Presented By:\nMohith Raj K Kotian\nUSN: 4MW23CS76\nDept. of CSE, SMVITM, Bantakal\n\nUnder the Guidance of:\nDr. Bharti Panjwani\nAssociate Professor, Dept. of CSE, SMVITM"

# Slide 2: Problem Statement
slide_layout = prs.slide_layouts[1]
slide = prs.slides.add_slide(slide_layout)
title = slide.shapes.title
content = slide.placeholders[1]
title.text = "Problem Statement"
content.text_frame.text = "Traditional weather apps lack real-time hazard analysis"
p = content.text_frame.add_paragraph()
p.text = "No multi-model AI forecasting"
p = content.text_frame.add_paragraph()
p.text = "Limited travel-route weather assessment"
p = content.text_frame.add_paragraph()
p.text = "No real-time lightning detection"
p = content.text_frame.add_paragraph()
p.text = "No personalized risk scoring"
p = content.text_frame.add_paragraph()
p.text = "Goal: Build an intelligent forecasting + risk analysis platform with real-time alerts"

# Slide 3: Introduction
slide = prs.slides.add_slide(slide_layout)
title = slide.shapes.title
content = slide.placeholders[1]
title.text = "Introduction"
content.text_frame.text = "Weather affects safety, agriculture, travel, daily activities"
p = content.text_frame.add_paragraph()
p.text = "Current apps only show basic forecasts"
p = content.text_frame.add_paragraph()
p.text = "WeatherPulse solves accuracy + real-time hazard problems"
p = content.text_frame.add_paragraph()
p.text = "Uses AI + dual-API system"
p = content.text_frame.add_paragraph()
p.text = "Provides analytics, alerts, lightning detection, hazard scoring"

# Slide 4: Objectives
slide = prs.slides.add_slide(slide_layout)
title = slide.shapes.title
content = slide.placeholders[1]
title.text = "Objectives"
content.text_frame.text = "Integrate Tomorrow.io + OpenWeather APIs"
p = content.text_frame.add_paragraph()
p.text = "Multi-model AI forecasting (7-day)"
p = content.text_frame.add_paragraph()
p.text = "Lightning detection"
p = content.text_frame.add_paragraph()
p.text = "Dynamic risk scoring algorithm"
p = content.text_frame.add_paragraph()
p.text = "Hazard alert system"
p = content.text_frame.add_paragraph()
p.text = "Travel safety assessment using Haversine"
p = content.text_frame.add_paragraph()
p.text = "AI assistant for user queries"
p = content.text_frame.add_paragraph()
p.text = "Build a complete frontend + backend system"

# Slide 5: Literature Review
slide = prs.slides.add_slide(slide_layout)
title = slide.shapes.title
title.text = "Literature Review"
rows = 5
cols = 2
left = Inches(1.0)
top = Inches(2.0)
width = Inches(8.0)
height = Inches(4.0)
table = slide.shapes.add_table(rows, cols, left, top, width, height).table
table.columns[0].width = Inches(3.0)
table.columns[1].width = Inches(5.0)
table.cell(0, 0).text = "Domain"
table.cell(0, 1).text = "Contribution / Finding"
table.cell(1, 0).text = "Multi-model forecasting (AI + NWP)"
table.cell(1, 1).text = "Ensemble methods improve accuracy over single models."
table.cell(2, 0).text = "API-driven weather platforms"
table.cell(2, 1).text = "APIs enable rapid development and integration of diverse data sources."
table.cell(3, 0).text = "Lightning detection research"
table.cell(3, 1).text = "Real-time detection is critical for safety and is achievable with modern sensors."
table.cell(4, 0).text = "Travel assessment and route-based hazard analysis"
table.cell(4, 1).text = "Route-based analysis provides more relevant warnings than general area alerts."

# Slide 6: Proposed System Overview
slide = prs.slides.add_slide(slide_layout)
title = slide.shapes.title
content = slide.placeholders[1]
title.text = "Proposed System Overview"
content.text_frame.text = "API Data Layer"
p = content.text_frame.add_paragraph()
p.text = "Backend Computing Layer"
p = content.text_frame.add_paragraph()
p.text = "Algorithms"
p = content.text_frame.add_paragraph()
p.text = "Alert Engine"
p = content.text_frame.add_paragraph()
p.text = "Frontend Dashboard"

# Slide 7: Detailed Methodology
slide = prs.slides.add_slide(slide_layout)
title = slide.shapes.title
content = slide.placeholders[1]
title.text = "Detailed Methodology"
content.text_frame.text = "1. Fetch API data"
p = content.text_frame.add_paragraph()
p.text = "2. Merge & normalize"
p = content.text_frame.add_paragraph()
p.text = "3. AI forecasting"
p = content.text_frame.add_paragraph()
p.text = "4. Hazard scoring"
p = content.text_frame.add_paragraph()
p.text = "5. Lightning detection"
p = content.text_frame.add_paragraph()
p.text = "6. Alerts + travel assessment"
p = content.text_frame.add_paragraph()
p.text = "7. Display in UI"

# Slide 8: System Architecture Diagram
slide = prs.slides.add_slide(slide_layout)
title = slide.shapes.title
content = slide.placeholders[1]
title.text = "System Architecture Diagram"
content.text = "[Insert System Architecture Diagram Here]\nAPIs → Flask Backend → Algorithms → DB → Frontend → User"

# Slide 9: Data Flow Diagram
slide = prs.slides.add_slide(slide_layout)
title = slide.shapes.title
content = slide.placeholders[1]
title.text = "Data Flow Diagram"
content.text = "[Insert Level-0 DFD Here]\nUser → Input → Backend → API → Processing → Output"

# Slide 10: Use Case Diagram
slide = prs.slides.add_slide(slide_layout)
title = slide.shapes.title
content = slide.placeholders[1]
title.text = "Use Case Diagram"
content.text = "[Insert Use Case Diagram Here]\nActors: User, System\nUse Cases: View forecast, Check alerts, Travel safety, AI query"

# Slide 11: Algorithms Used
slide = prs.slides.add_slide(slide_layout)
title = slide.shapes.title
content = slide.placeholders[1]
title.text = "Algorithms Used"
content.text_frame.text = "Multi-model AI ensemble"
p = content.text_frame.add_paragraph()
p.text = "Lightning detection algorithm"
p = content.text_frame.add_paragraph()
p.text = "Risk scoring formula"
p = content.text_frame.add_paragraph()
p.text = "Haversine distance"
p = content.text_frame.add_paragraph()
p.text = "Heat Index, Dew Point formulas"

# Slide 12: Modules Description
slide = prs.slides.add_slide(slide_layout)
title = slide.shapes.title
content = slide.placeholders[1]
title.text = "Modules Description"
content.text_frame.text = "Forecasting Module"
p = content.text_frame.add_paragraph()
p.text = "Lightning Module"
p = content.text_frame.add_paragraph()
p.text = "Alert Module"
p = content.text_frame.add_paragraph()
p.text = "Travel Safety Module"
p = content.text_frame.add_paragraph()
p.text = "AI Assistant Module"
p = content.text_frame.add_paragraph()
p.text = "Dashboard Module"

# Slide 13: Technology Stack
slide = prs.slides.add_slide(slide_layout)
title = slide.shapes.title
title.text = "Technology Stack"
# Backend Table
rows = 3
cols = 2
left = Inches(1.0)
top = Inches(2.0)
width = Inches(4.0)
height = Inches(2.0)
table = slide.shapes.add_table(rows, cols, left, top, width, height).table
table.cell(0, 0).text = "Backend"
table.cell(0, 1).text = "Technology"
table.cell(1, 0).text = "Framework"
table.cell(1, 1).text = "Flask"
table.cell(2, 0).text = "Language"
table.cell(2, 1).text = "Python"
# Frontend Table
left = Inches(5.5)
table = slide.shapes.add_table(rows, cols, left, top, width, height).table
table.cell(0, 0).text = "Frontend"
table.cell(0, 1).text = "Technology"
table.cell(1, 0).text = "Markup/Styling"
table.cell(1, 1).text = "HTML, CSS"
table.cell(2, 0).text = "Scripting"
table.cell(2, 1).text = "JavaScript"
# APIs/Libraries Table
rows = 3
cols = 2
top = Inches(4.5)
left = Inches(1.0)
width = Inches(8.0)
height = Inches(2.0)
table = slide.shapes.add_table(rows, cols, left, top, width, height).table
table.cell(0, 0).text = "APIs & Libraries"
table.cell(0, 1).text = "Name"
table.cell(1, 0).text = "APIs"
table.cell(1, 1).text = "Tomorrow.io, OpenWeather"
table.cell(2, 0).text = "Libraries"
table.cell(2, 1).text = "NumPy, Requests, Pandas"

# Slide 14: System Implementation Screenshots
slide = prs.slides.add_slide(slide_layout)
title = slide.shapes.title
content = slide.placeholders[1]
title.text = "System Implementation Screenshots"
content.text_frame.text = "[Placeholder for Dashboard Screenshot]"
p = content.text_frame.add_paragraph()
p.text = "[Placeholder for Forecast Page Screenshot]"
p = content.text_frame.add_paragraph()
p.text = "[Placeholder for Hazard Alerts Screenshot]"
p = content.text_frame.add_paragraph()
p.text = "[Placeholder for Travel Safety Analysis Screenshot]"
p = content.text_frame.add_paragraph()
p.text = "[Placeholder for AI Assistant Screenshot]"

# Slide 15: Results
slide = prs.slides.add_slide(slide_layout)
title = slide.shapes.title
content = slide.placeholders[1]
title.text = "Results"
content.text_frame.text = "API response time: [Time in ms]"
p = content.text_frame.add_paragraph()
p.text = "Forecast accuracy table: [Table showing model accuracy]"
p = content.text_frame.add_paragraph()
p.text = "Lightning detection success rate: [Percentage]"
p = content.text_frame.add_paragraph()
p.text = "Travel rating accuracy: [Percentage]"

# Slide 16: Discussion
slide = prs.slides.add_slide(slide_layout)
title = slide.shapes.title
content = slide.placeholders[1]
title.text = "Discussion"
content.text_frame.text = "System works reliably under various test conditions."
p = content.text_frame.add_paragraph()
p.text = "Risk scoring algorithm provides accurate and timely warnings."
p = content.text_frame.add_paragraph()
p.text = "Travel safety feature adds significant value for users on the move."
p = content.text_frame.add_paragraph()
p.text = "Real-time lightning alerts are effective."
p = content.text_frame.add_paragraph()
p.text = "The AI assistant enhances usability and provides a modern user experience."

# Slide 17: Conclusion
slide = prs.slides.add_slide(slide_layout)
title = slide.shapes.title
content = slide.placeholders[1]
title.text = "Conclusion"
content.text_frame.text = "WeatherPulse successfully addresses gaps in existing weather systems."
p = content.text_frame.add_paragraph()
p.text = "The use of AI and multi-model forecasting improves accuracy."
p = content.text_frame.add_paragraph()
p.text = "Real-time hazard detection enhances user safety."
p = content.text_frame.add_paragraph()
p.text = "The platform is designed to be scalable and extendable for future enhancements."

# Slide 18: Future Work
slide = prs.slides.add_slide(slide_layout)
title = slide.shapes.title
content = slide.placeholders[1]
title.text = "Future Work"
content.text_frame.text = "Develop a native mobile application for iOS and Android."
p = content.text_frame.add_paragraph()
p.text = "Implement push notifications for real-time alerts."
p = content.text_frame.add_paragraph()
p.text = "Enhance the AI assistant with NLP for more natural conversations."
p = content.text_frame.add_paragraph()
p.text = "Use machine learning to refine the risk scoring algorithm over time."
p = content.text_frame.add_paragraph()
p.text = "Integrate more data sources for even greater accuracy."
p = content.text_frame.add_paragraph()
p.text = "Incorporate data from IoT sensors for hyper-local forecasting."

# Slide 19: References
slide = prs.slides.add_slide(slide_layout)
title = slide.shapes.title
content = slide.placeholders[1]
title.text = "References"
content.text_frame.text = "[1] Tomorrow.io, \"Weather API Documentation,\" [Online]. Available: [URL]."
p = content.text_frame.add_paragraph()
p.text = "[2] OpenWeather, \"API Documentation,\" [Online]. Available: [URL]."
p = content.text_frame.add_paragraph()
p.text = "[3] A. Author, B. Author, \"Title of Ensemble Forecasting Paper,\" in Journal of Weather Forecasting, vol. X, no. Y, pp. 1-10, Year."
p = content.text_frame.add_paragraph()
p.text = "[4] Flask, \"Flask Documentation,\" [Online]. Available: [URL]."
p = content.text_frame.add_paragraph()
p.text = "[5] R. W. Sinnott, \"Virtues of the Haversine,\" Sky and Telescope, vol. 68, no. 2, p. 159, 1984."

# Slide 20: Q&A
slide_layout = prs.slide_layouts[8] # Title Only layout
slide = prs.slides.add_slide(slide_layout)
title = slide.shapes.title
title.text = "Q & A"
# Add a subtitle with "Thank You"
left = Inches(1.0)
top = Inches(3.0)
width = Inches(8.0)
height = Inches(2.0)
txBox = slide.shapes.add_textbox(left, top, width, height)
tf = txBox.text_frame
p = tf.add_paragraph()
p.text = "Thank You"
p.font.size = Pt(44)
p.alignment = PP_ALIGN.CENTER

# Save the presentation
prs.save("WeatherPulse.pptx")
print("Presentation 'WeatherPulse.pptx' created successfully.")
