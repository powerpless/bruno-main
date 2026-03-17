import styled from 'styled-components';

const StyledWrapper = styled.div`
  .textbox {
    border: 1px solid ${(props) => props.theme.input.border};
    padding: 0.35rem 0.6rem;
    border-radius: 3px;
    outline: none;
    background-color: ${(props) => props.theme.input.bg};
    transition: border-color ease-in-out 0.1s;
    width: 100%;

    &:focus {
      border-color: ${(props) => props.theme.input.focusBorder};
      outline: none;
    }
  }

  .toggle-label {
    font-size: 0.875rem;
  }
`;

export default StyledWrapper;
