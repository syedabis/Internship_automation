import os
import streamlit as st
from dotenv import load_dotenv

load_dotenv()

st.set_page_config(
    page_title="DataCrumbs Certificate Automation",
    page_icon="🎓",
    layout="wide"
)

st.title("🎓 DataCrumbs Certificate & Automation Engine")
st.markdown("Automated certificate generation, verification, and email dispatch platform.")

tab1, tab2 = st.tabs(["💼 Internship Completion Certificates", "🎓 Workshop Certificates"])

with tab1:
    st.header("💼 Internship Completion Certificate Automation")
    st.markdown("""
    Generates high-resolution **Internship Completion Certificates** and emails them to verified interns.
    - **Template**: `6-Week Internship Program.png`
    - **Dynamic Fields**: Intern Name, Awarded Date, Certificate ID, Program Title.
    - **Google Sheet Integration**: Automatically reads intern details and updates status to `sent`.
    """)
    
    col1, col2 = st.columns(2)
    with col1:
        if st.button("🚀 Run Internship Certificate Automation", type="primary"):
            log_area = st.empty()
            log_messages = []
            
            def web_logger(msg):
                log_messages.append(msg)
                log_area.text_area("Live Processing Logs", "\n".join(log_messages), height=300)
            
            with st.spinner("Processing Internship Certificates..."):
                try:
                    from send_internship_certificate import process_internship_certificates
                    process_internship_certificates(log_callback=web_logger)
                    st.success("🎉 Internship Certificate processing finished!")
                except Exception as e:
                    st.error(f"Error executing internship automation: {e}")

    with col2:
        st.subheader("🖼️ Internship Template Preview")
        if os.path.exists("6-Week Internship Program.png"):
            st.image("6-Week Internship Program.png", caption="Internship Completion Certificate Template")
        else:
            st.warning("Template file '6-Week Internship Program.png' not found.")

with tab2:
    st.header("🎓 Workshop Certificates")
    st.markdown("""
    Generates and dispatches **Workshop Certificates** based on codes in Google Sheets (`Sheet1` & `Sheet2`).
    """)
    
    if st.button("🚀 Run Workshop Certificate Automation", type="primary"):
        log_area2 = st.empty()
        
        def web_logger2(msg):
            log_area2.write(msg)
            
        with st.spinner("Processing Workshop Certificates..."):
            try:
                from send_certificate import main as send_certificate_main
                web_logger2("🚀 Starting workshop certificate generation process...")
                send_certificate_main()
                web_logger2("✅ Workshop certificate generation process completed!")
                st.success("Workshop certificate process completed!")
            except Exception as e:
                st.error(f"Error executing workshop automation: {e}")
